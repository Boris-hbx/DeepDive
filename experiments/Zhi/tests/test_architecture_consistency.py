"""
Test cross-section architecture consistency.

Verifies claims that span multiple sections of the document:
- V3 layer configuration
- V3.2 Indexer parameters
- V4 attention cache calculations
- Parameter relationships across versions
"""
import pytest
import math


class TestV3LayerConfiguration:
    """Verify V3 671B layer structure (Section 1.1)."""

    def test_layer_count(self, v3_config):
        """
        Claim: V3 has 61 layers total
        """
        assert v3_config["n_layers"] == 61

    def test_dense_layers_first(self, v3_config):
        """
        Claim: 前 3 层是 Dense（不使用 MoE），其余 58 层使用 MoE
        """
        n_layers = v3_config["n_layers"]
        n_dense = v3_config["n_dense_layers"]

        assert n_dense == 3
        n_moe_layers = n_layers - n_dense
        assert n_moe_layers == 58

    def test_hidden_dim(self, v3_config):
        """
        Claim: hidden dimension = 7168
        """
        assert v3_config["dim"] == 7168


class TestV32IndexerConsistency:
    """Verify V3.2 Indexer parameter relationships (Section 2.1)."""

    def test_indexer_heads_half_of_main(self, v32_config):
        """
        Claim: index_n_heads (64) = n_heads (128) / 2
        Indexer uses half the attention heads of the main model.
        """
        assert v32_config["index_n_heads"] == v32_config["n_heads"] // 2
        assert v32_config["index_n_heads"] == 64

    def test_indexer_head_dim(self, v32_config):
        """
        Claim: index_head_dim = 128 (same as qk_nope_head_dim)
        """
        assert v32_config["index_head_dim"] == 128
        assert v32_config["index_head_dim"] == v32_config["qk_nope_head_dim"]

    def test_indexer_topk(self, v32_config):
        """
        Claim: index_topk = 2048 (select top-2048 tokens from full context)
        """
        assert v32_config["index_topk"] == 2048

    def test_hadamard_preserves_norm(self):
        """
        Claim: Hadamard 变换是正交变换，保持向量范数不变

        Verify: ||Hx|| = ||x|| for Hadamard matrix H
        """
        import torch

        # Construct a 128×128 Hadamard-like matrix (Walsh-Hadamard)
        # For power-of-2 dimensions, we can build it recursively
        def hadamard_matrix(n):
            """Build normalized Hadamard matrix of size n (n must be power of 2)."""
            if n == 1:
                return torch.tensor([[1.0]])
            h_half = hadamard_matrix(n // 2)
            h = torch.cat([
                torch.cat([h_half, h_half], dim=1),
                torch.cat([h_half, -h_half], dim=1),
            ], dim=0)
            return h

        dim = 128  # index_head_dim
        H = hadamard_matrix(dim) / math.sqrt(dim)  # Normalized

        # Verify orthogonality: H @ H^T = I
        identity = H @ H.T
        assert torch.allclose(identity, torch.eye(dim), atol=1e-5)

        # Verify norm preservation: ||Hx|| = ||x||
        x = torch.randn(dim)
        Hx = H @ x
        assert torch.allclose(x.norm(), Hx.norm(), atol=1e-5)


class TestV4AttentionCacheCalculations:
    """Verify V4 multi-level attention cache sizes (Section 3.1)."""

    def test_mla_cache_dim(self, v4_config):
        """
        Claim: MLA cache dimension = kv_lora_rank + qk_rope_head_dim = 512 + 64 = 576
        """
        kv_lora_rank = v4_config["kv_lora_rank"]
        qk_rope_head_dim = v4_config["qk_rope_head_dim"]
        assert kv_lora_rank + qk_rope_head_dim == 576
        assert v4_config["mla_cache_dim"] == 576

    def test_swa_cache_size(self, v4_config):
        """
        Claim: SWA (Sliding Window Attention) cache per layer
        = swa_window × mla_cache_dim = 128 × 576 = 73,728
        """
        swa_window = v4_config["swa_window_size"]
        cache_dim = v4_config["mla_cache_dim"]

        swa_cache = swa_window * cache_dim
        assert swa_cache == 128 * 576 == 73_728

    def test_csa_compression(self, v4_config):
        """
        Claim: CSA (C4) compresses 1M tokens → 250K positions (4:1 ratio)
        """
        context_length = 1_000_000
        c4_ratio = v4_config["csa_compress_ratio"]

        compressed_positions = context_length // c4_ratio
        assert compressed_positions == 250_000

    def test_csa_cache_size(self, v4_config):
        """
        Claim: C4 cache per layer = 250K × 576 = 144,000,000 (144M elements)
        """
        context_length = 1_000_000
        c4_ratio = v4_config["csa_compress_ratio"]
        cache_dim = v4_config["mla_cache_dim"]

        c4_positions = context_length // c4_ratio
        c4_cache = c4_positions * cache_dim
        assert c4_cache == 250_000 * 576 == 144_000_000

    def test_hca_compression(self, v4_config):
        """
        Claim: HCA (C128) compresses 1M tokens → ~8K summaries (128:1 ratio)
        """
        context_length = 1_000_000
        c128_ratio = v4_config["hca_compress_ratio"]

        summaries = context_length // c128_ratio
        # 1M / 128 = 7812.5, rounded to ~8K
        assert summaries == 7812  # exact integer division
        assert abs(summaries - 8000) < 500  # approximately 8K

    def test_hca_cache_size(self, v4_config):
        """
        Claim: C128 cache per layer = ~8K × 576 ≈ 4.5M elements
        """
        context_length = 1_000_000
        c128_ratio = v4_config["hca_compress_ratio"]
        cache_dim = v4_config["mla_cache_dim"]

        c128_positions = context_length // c128_ratio
        c128_cache = c128_positions * cache_dim
        # 7812 × 576 = 4,499,712 ≈ 4.5M
        assert c128_cache == 7812 * 576 == 4_499_712
        assert abs(c128_cache - 4_500_000) < 100_000  # approximately 4.5M

    def test_total_v4_cache_per_layer(self, v4_config):
        """
        Claim: V4 total cache per layer ≈ SWA + C4 + C128
        = 73,728 + 144,000,000 + 4,499,712 ≈ 148.6M

        vs standard MHA: 1M × 32,768 = 32.8B (per layer)
        """
        context_length = 1_000_000
        cache_dim = v4_config["mla_cache_dim"]
        swa_window = v4_config["swa_window_size"]
        c4_ratio = v4_config["csa_compress_ratio"]
        c128_ratio = v4_config["hca_compress_ratio"]

        swa_cache = swa_window * cache_dim
        c4_cache = (context_length // c4_ratio) * cache_dim
        c128_cache = (context_length // c128_ratio) * cache_dim

        total_v4 = swa_cache + c4_cache + c128_cache
        # Should be around 148-149M
        assert 148_000_000 < total_v4 < 150_000_000

        # Compare with standard MHA (128 heads × 256 dim = 32,768 per token)
        mha_cache = context_length * 2 * 128 * 128  # 2 × n_heads × head_dim
        # V4 should be dramatically smaller
        assert total_v4 < mha_cache / 100  # More than 100x smaller

    def test_csa_topk_selection(self, v4_config):
        """
        Claim: CSA selects top-512 compressed positions for attention
        """
        assert v4_config["csa_topk"] == 512

        # After C4 compression: 250K positions available
        # Select top-512 → 512/250000 ≈ 0.2% of compressed positions
        c4_positions = 1_000_000 // v4_config["csa_compress_ratio"]
        selection_ratio = v4_config["csa_topk"] / c4_positions
        assert selection_ratio == pytest.approx(0.002048, abs=0.001)


class TestVersionEvolution:
    """Verify parameter evolution across V3 → V3.2 → V4."""

    def test_mla_preserved_across_versions(self, v3_config, v32_config, v4_config):
        """
        Claim: MLA core parameters (kv_lora_rank, qk_rope_head_dim) are
        preserved across all versions.
        """
        # All versions share the same MLA compression
        assert v3_config["kv_lora_rank"] == v32_config["kv_lora_rank"] == v4_config["kv_lora_rank"]
        assert v3_config["qk_rope_head_dim"] == v32_config["qk_rope_head_dim"] == v4_config["qk_rope_head_dim"]

    def test_moe_preserved_across_versions(self, v3_config, v32_config, v4_config):
        """
        Claim: MoE routing structure is preserved across versions.
        """
        assert v3_config["n_routed_experts"] == v32_config["n_routed_experts"] == v4_config["n_routed_experts"]
        assert v3_config["n_activated_experts"] == v32_config["n_activated_experts"] == v4_config["n_activated_experts"]

    def test_v32_adds_indexer(self, v3_config, v32_config):
        """
        Claim: V3.2 adds Indexer mechanism (not present in V3)
        """
        assert "index_n_heads" not in v3_config
        assert "index_n_heads" in v32_config
        assert v32_config["index_n_heads"] == 64

    def test_v4_adds_multi_level_attention(self, v32_config, v4_config):
        """
        Claim: V4 adds CSA/HCA multi-level attention (not present in V3.2)
        """
        assert "csa_compress_ratio" not in v32_config
        assert "csa_compress_ratio" in v4_config
        assert v4_config["csa_compress_ratio"] == 4
        assert v4_config["hca_compress_ratio"] == 128
