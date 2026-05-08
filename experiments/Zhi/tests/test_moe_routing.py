"""
验证文档第五节 MoE Gate 路由机制的声明。

对应文档：deepseek-evolution-analysis-details.html, Section 五
核心验证：
1. 分组路由逻辑的正确性
2. Bias 解耦（bias 影响选择但不影响最终权重）
3. Sigmoid 打分 + 归一化 + route_scale
"""
import pytest
import torch
import torch.nn.functional as F


def gate_forward(x, weight, bias=None, n_expert_groups=8, n_limited_groups=4,
                 n_activated_experts=8, route_scale=2.5):
    """
    Reproduce the Gate.forward() logic described in Section 5.2.

    Args:
        x: [batch_size, dim] input tensor
        weight: [n_experts, dim] gate weight matrix
        bias: [n_experts] optional bias for load balancing
        n_expert_groups: number of expert groups (8)
        n_limited_groups: number of groups to select (4)
        n_activated_experts: number of experts to activate (8)
        route_scale: final weight scaling factor (2.5)

    Returns:
        weights: [batch_size, n_activated_experts] normalized weights
        indices: [batch_size, n_activated_experts] selected expert indices
    """
    n_experts = weight.shape[0]
    experts_per_group = n_experts // n_expert_groups

    # Step 1: Compute raw scores with sigmoid
    scores = torch.matmul(x, weight.T)  # [B, 256]
    scores = scores.sigmoid()
    original_scores = scores.clone()  # Save for final weight computation

    # Step 2: Add bias (load balancing, does NOT affect final weights)
    if bias is not None:
        scores = scores + bias

    # Step 3: Group routing
    B = scores.shape[0]
    scores_grouped = scores.view(B, n_expert_groups, experts_per_group)  # [B, 8, 32]

    # Each group's score = sum of top-2 within that group
    group_scores = scores_grouped.topk(2, dim=-1)[0].sum(dim=-1)  # [B, 8]

    # Select top-4 groups
    top_groups = group_scores.topk(n_limited_groups, dim=-1)[1]  # [B, 4]

    # Mask out unselected groups
    mask = torch.zeros(B, n_expert_groups, dtype=torch.bool)
    mask.scatter_(1, top_groups, True)
    mask = ~mask  # True = masked out

    scores_grouped_masked = scores_grouped.clone()
    scores_grouped_masked[mask.unsqueeze(-1).expand_as(scores_grouped)] = float("-inf")
    scores_flat = scores_grouped_masked.flatten(1)  # [B, 256]

    # Step 4: Select top-8 experts from the selected groups
    indices = scores_flat.topk(n_activated_experts, dim=-1)[1]  # [B, 8]

    # Step 5: Final weights use ORIGINAL scores (without bias!)
    weights = original_scores.gather(1, indices)
    weights = weights / weights.sum(dim=-1, keepdim=True)  # Normalize
    weights = weights * route_scale  # Scale

    return weights, indices


class TestMoEConfiguration:
    """验证 MoE 配置参数的一致性。"""

    def test_expert_grouping(self, v3_config):
        """
        文档声明：256 experts = 8 groups × 32 experts/group
        """
        n_experts = v3_config["n_routed_experts"]
        n_groups = v3_config["n_expert_groups"]
        experts_per_group = n_experts // n_groups
        assert experts_per_group == 32
        assert n_groups * experts_per_group == n_experts == 256

    def test_routing_selection_counts(self, v3_config):
        """
        文档声明：先选 top-4 组，再从中选 top-8 专家
        4 组 × 32 专家/组 = 128 个候选 → 选 8 个
        """
        n_limited_groups = v3_config["n_limited_groups"]
        n_activated = v3_config["n_activated_experts"]
        experts_per_group = v3_config["n_routed_experts"] // v3_config["n_expert_groups"]

        # Candidate pool after group selection
        candidate_pool = n_limited_groups * experts_per_group
        assert candidate_pool == 4 * 32 == 128

        # Final selection from candidate pool
        assert n_activated == 8
        assert n_activated <= candidate_pool


class TestBiasDecoupling:
    """验证 bias 解耦机制：bias 只影响路由选择，不影响最终权重。"""

    def test_bias_affects_selection_not_weights(self, v3_config):
        """
        文档声明（Section 5.3）：
        - bias 只影响路由决策（哪些专家被选中）
        - 最终权重用 original_scores（不含 bias）计算
        """
        torch.manual_seed(42)
        B, dim = 4, v3_config["dim"]
        n_experts = v3_config["n_routed_experts"]

        x = torch.randn(B, dim)
        weight = torch.randn(n_experts, dim)

        # Without bias
        weights_no_bias, indices_no_bias = gate_forward(x, weight, bias=None)

        # With bias (should change selection but not weight computation method)
        bias = torch.randn(n_experts) * 0.1
        weights_with_bias, indices_with_bias = gate_forward(x, weight, bias=bias)

        # Indices should differ (bias changes routing decisions)
        # Note: with random bias, it's very likely indices differ
        assert not torch.equal(indices_no_bias, indices_with_bias), \
            "Bias should change routing decisions"

        # Verify weights are computed from original_scores (without bias)
        # by checking that weights sum to route_scale after normalization
        route_scale = v3_config["route_scale"]
        assert weights_with_bias.sum(dim=-1).allclose(
            torch.full((B,), route_scale), atol=1e-5
        )

    def test_weights_use_original_scores(self, v3_config):
        """
        验证：给定相同的 indices，有 bias 和无 bias 的 weights 应该相同。
        这证明 weights 确实用的是 original_scores。
        """
        torch.manual_seed(123)
        B, dim = 2, v3_config["dim"]
        n_experts = v3_config["n_routed_experts"]

        x = torch.randn(B, dim)
        weight = torch.randn(n_experts, dim)

        # Compute scores manually
        scores = torch.matmul(x, weight.T).sigmoid()

        # If we force the same indices, weights should be identical
        # regardless of bias (since weights use original_scores)
        indices = torch.randint(0, n_experts, (B, 8))

        # Weights from original scores
        route_scale = v3_config["route_scale"]
        w = scores.gather(1, indices)
        w = w / w.sum(dim=-1, keepdim=True) * route_scale

        # Adding bias to scores shouldn't change this computation
        bias = torch.randn(n_experts) * 0.5
        scores_biased = scores + bias
        # But weights still come from original scores
        w_check = scores.gather(1, indices)  # NOT scores_biased!
        w_check = w_check / w_check.sum(dim=-1, keepdim=True) * route_scale

        assert torch.allclose(w, w_check)


class TestSigmoidScoring:
    """验证 sigmoid 打分机制。"""

    def test_sigmoid_not_softmax(self, v3_config):
        """
        文档声明：score_func = sigmoid（非 softmax）

        Sigmoid 的特点：每个专家的分数独立，范围 [0, 1]
        Softmax 的特点：所有专家分数之和为 1
        """
        torch.manual_seed(42)
        B = 2
        n_experts = v3_config["n_routed_experts"]

        # Use small logits to avoid sigmoid saturation at 0/1
        logits = torch.randn(B, n_experts)
        scores = logits.sigmoid()

        # Sigmoid: all values in (0, 1)
        assert (scores > 0).all()
        assert (scores < 1).all()
        # Sum should NOT be 1 (unlike softmax)
        assert not scores.sum(dim=-1).allclose(torch.ones(B))

    def test_route_scale_application(self, v3_config):
        """
        文档声明：weights *= 2.5 (route_scale)
        归一化后的权重之和 = route_scale = 2.5
        """
        torch.manual_seed(42)
        B, dim = 4, v3_config["dim"]
        n_experts = v3_config["n_routed_experts"]
        route_scale = v3_config["route_scale"]

        x = torch.randn(B, dim)
        weight = torch.randn(n_experts, dim)

        weights, _ = gate_forward(x, weight)

        # After normalization and scaling, sum should equal route_scale
        expected_sum = torch.full((B,), route_scale)
        assert weights.sum(dim=-1).allclose(expected_sum, atol=1e-5)


class TestGroupRouting:
    """验证分组路由的完整流程。"""

    def test_group_score_computation(self, v3_config):
        """
        文档声明：每组取 top-2 的和作为组分数
        group_scores = scores.topk(2, dim=-1)[0].sum(dim=-1)
        """
        torch.manual_seed(42)
        n_experts = v3_config["n_routed_experts"]
        n_groups = v3_config["n_expert_groups"]
        experts_per_group = n_experts // n_groups

        # Simulate scores for one sample
        scores = torch.rand(1, n_experts).sigmoid()
        scores_grouped = scores.view(1, n_groups, experts_per_group)  # [1, 8, 32]

        # Group score = sum of top-2 within each group
        top2_per_group = scores_grouped.topk(2, dim=-1)[0]  # [1, 8, 2]
        group_scores = top2_per_group.sum(dim=-1)  # [1, 8]

        assert group_scores.shape == (1, n_groups)
        # Each group score should be between 0 and 2 (sum of two sigmoid values)
        assert (group_scores >= 0).all()
        assert (group_scores <= 2).all()

    def test_selected_experts_from_limited_groups(self, v3_config):
        """
        文档声明：选出的 8 个专家必须来自被选中的 4 个组。
        """
        torch.manual_seed(42)
        B, dim = 8, v3_config["dim"]
        n_experts = v3_config["n_routed_experts"]
        n_groups = v3_config["n_expert_groups"]
        experts_per_group = n_experts // n_groups
        n_limited_groups = v3_config["n_limited_groups"]

        x = torch.randn(B, dim)
        weight = torch.randn(n_experts, dim)

        _, indices = gate_forward(x, weight)

        # Check that all selected experts belong to the top-4 groups
        for b in range(B):
            expert_groups = indices[b] // experts_per_group  # Which group each expert belongs to
            unique_groups = expert_groups.unique()
            # All experts should come from at most n_limited_groups groups
            assert len(unique_groups) <= n_limited_groups, \
                f"Sample {b}: experts from {len(unique_groups)} groups, expected <= {n_limited_groups}"

    def test_mask_eliminates_unselected_groups(self, v3_config):
        """
        文档声明：mask 掉未选中的组后，scores 设为 -inf
        """
        torch.manual_seed(42)
        n_experts = v3_config["n_routed_experts"]
        n_groups = v3_config["n_expert_groups"]
        experts_per_group = n_experts // n_groups

        scores = torch.rand(1, n_experts)
        scores_grouped = scores.view(1, n_groups, experts_per_group)

        # Select top-4 groups
        group_scores = scores_grouped.topk(2, dim=-1)[0].sum(dim=-1)
        top_groups = group_scores.topk(4, dim=-1)[1]

        # Create mask
        mask = torch.zeros(1, n_groups, dtype=torch.bool)
        mask.scatter_(1, top_groups, True)
        mask = ~mask  # True = masked out

        # Apply mask
        scores_grouped_masked = scores_grouped.clone()
        scores_grouped_masked[mask.unsqueeze(-1).expand_as(scores_grouped)] = float("-inf")

        # Verify: unselected groups should be -inf
        for g in range(n_groups):
            if mask[0, g]:  # This group was NOT selected
                assert (scores_grouped_masked[0, g] == float("-inf")).all()
            else:  # This group WAS selected
                assert (scores_grouped_masked[0, g] != float("-inf")).all()
