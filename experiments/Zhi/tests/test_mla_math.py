"""
Test MLA (Multi-head Latent Attention) mathematical claims.

Verifies Section 一 of deepseek-evolution-analysis-details.html:
- KV cache size calculations
- Compression ratio (~57x)
- Dimension chain correctness
- Absorb optimization validity
"""
import pytest
import torch


class TestKVCacheCalculations:
    """Verify KV cache size formulas from Section 1.2."""

    def test_mha_kv_cache_per_token(self, v3_config):
        """
        Claim: KV_cache_MHA = 2 × n_heads × head_dim per token per layer
               Per token across all layers: 2 × 128 × 128 × 61 = 1,998,848

        The document's formula: 2 × n_heads × head_dim × n_layers
        """
        n_heads = v3_config["n_heads"]
        # In standard MHA, head_dim for KV = qk_nope_head_dim (128) for K
        # and v_head_dim (128) for V, so total per head = 128 + 128 = 256
        # This means: K cache (n_heads × head_dim) + V cache (n_heads × head_dim)
        head_dim = v3_config["qk_nope_head_dim"]  # 128
        n_layers = v3_config["n_layers"]

        # Per-token-per-layer KV cache
        kv_per_token_per_layer = 2 * n_heads * head_dim
        assert kv_per_token_per_layer == 32_768  # 2 × 128 × 128

        # Total across all 61 layers
        kv_per_token = kv_per_token_per_layer * n_layers
        assert kv_per_token == 1_998_848  # 32,768 × 61

    def test_mla_kv_cache_per_token(self, v3_config):
        """
        Claim: KV_cache_MLA = (kv_lora_rank + qk_rope_head_dim) × seq_len × n_layers
               = (512 + 64) × seq_len × 61 = 35,136 × seq_len
        """
        kv_lora_rank = v3_config["kv_lora_rank"]
        qk_rope_head_dim = v3_config["qk_rope_head_dim"]
        n_layers = v3_config["n_layers"]

        mla_per_token = (kv_lora_rank + qk_rope_head_dim) * n_layers
        assert mla_per_token == 35_136

    def test_compression_ratio(self, v3_config):
        """
        Claim: Compression ratio ≈ 57x (MHA vs MLA cache per token)
        MHA: 2 × 128 × 128 × 61 = 1,998,848
        MLA: 576 × 61 = 35,136
        Ratio: 1,998,848 / 35,136 ≈ 56.9x
        """
        n_heads = v3_config["n_heads"]
        head_dim = v3_config["qk_nope_head_dim"]
        kv_lora_rank = v3_config["kv_lora_rank"]
        qk_rope_head_dim = v3_config["qk_rope_head_dim"]
        n_layers = v3_config["n_layers"]

        mha = 2 * n_heads * head_dim * n_layers
        mla = (kv_lora_rank + qk_rope_head_dim) * n_layers
        ratio = mha / mla
        assert ratio == pytest.approx(56.9, abs=0.5)

    def test_mha_total_dim_per_token_per_layer(self, v3_config):
        """
        Claim: 标准 MHA 的 32,768 维（128头×256维）
        where 256 = head_dim for K (128) + head_dim for V (128)
        """
        n_heads = v3_config["n_heads"]
        head_dim_k = v3_config["qk_nope_head_dim"]
        head_dim_v = v3_config["v_head_dim"]
        total = n_heads * (head_dim_k + head_dim_v)
        assert total == 32_768

    def test_mla_total_dim_per_token_per_layer(self, v3_config):
        """
        Claim: MLA 只需 576 维 (512 + 64)
        """
        kv_lora_rank = v3_config["kv_lora_rank"]
        qk_rope_head_dim = v3_config["qk_rope_head_dim"]
        assert kv_lora_rank + qk_rope_head_dim == 576


class TestDimensionChains:
    """Verify dimension transformations in MLA forward pass (Section 1.3)."""

    def test_query_path_compression(self, v3_config):
        """
        Claim: Query path: 7168 → 1536 (wq_a compression)
        """
        dim = v3_config["dim"]
        q_lora_rank = v3_config["q_lora_rank"]
        # wq_a: Linear(dim, q_lora_rank)
        assert dim == 7168
        assert q_lora_rank == 1536

    def test_query_path_expansion(self, v3_config):
        """
        Claim: Query expansion: 1536 → 128 × 192
        where 192 = qk_nope_head_dim(128) + qk_rope_head_dim(64)
        """
        q_lora_rank = v3_config["q_lora_rank"]
        n_heads = v3_config["n_heads"]
        qk_nope = v3_config["qk_nope_head_dim"]
        qk_rope = v3_config["qk_rope_head_dim"]

        q_head_dim = qk_nope + qk_rope  # 192
        assert q_head_dim == 192

        # wq_b output total dim
        total_q_dim = n_heads * q_head_dim
        assert total_q_dim == 128 * 192 == 24_576

    def test_kv_path_compression(self, v3_config):
        """
        Claim: KV path: 7168 → 576, then split into (512, 64)
        wkv_a output = kv_lora_rank + qk_rope_head_dim = 576
        """
        kv_lora_rank = v3_config["kv_lora_rank"]
        qk_rope_head_dim = v3_config["qk_rope_head_dim"]

        wkv_a_output = kv_lora_rank + qk_rope_head_dim
        assert wkv_a_output == 576

    def test_kv_split_dimensions(self, v3_config):
        """
        Claim: split(kv_combined, [512, 64]) → c_kv(512) + k_pe(64)
        """
        kv_lora_rank = v3_config["kv_lora_rank"]
        qk_rope_head_dim = v3_config["qk_rope_head_dim"]

        # Simulate the split
        kv_combined = torch.randn(1, 10, kv_lora_rank + qk_rope_head_dim)
        c_kv, k_pe = kv_combined.split([kv_lora_rank, qk_rope_head_dim], dim=-1)

        assert c_kv.shape[-1] == 512
        assert k_pe.shape[-1] == 64

    def test_wkv_b_expansion(self, v3_config):
        """
        Claim: wkv_b expands c_kv(512) → n_heads × (qk_nope_head_dim + v_head_dim)
        = 128 × (128 + 128) = 128 × 256 = 32,768
        """
        n_heads = v3_config["n_heads"]
        qk_nope = v3_config["qk_nope_head_dim"]
        v_dim = v3_config["v_head_dim"]
        kv_lora_rank = v3_config["kv_lora_rank"]

        # wkv_b: Linear(kv_lora_rank, n_heads * (qk_nope + v_dim))
        wkv_b_output = n_heads * (qk_nope + v_dim)
        assert wkv_b_output == 32_768

        # Can be reshaped to [n_heads, qk_nope + v_dim, kv_lora_rank]
        wkv_b_weight = torch.randn(wkv_b_output, kv_lora_rank)
        reshaped = wkv_b_weight.view(n_heads, qk_nope + v_dim, kv_lora_rank)
        assert reshaped.shape == (128, 256, 512)


class TestAbsorbOptimization:
    """Verify the Absorb optimization logic (Section 1.3)."""

    def test_absorb_avoids_kv_expansion(self, v3_config):
        """
        Claim: Absorb trick computes attention in compressed space (512-dim)
        instead of expanded space (128 × 128 = 16,384 for K alone).

        Verify: q_nope_absorbed has shape [B, S, H, kv_lora_rank]
        """
        B, S, H = 1, 4, v3_config["n_heads"]
        kv_lora_rank = v3_config["kv_lora_rank"]
        qk_nope = v3_config["qk_nope_head_dim"]

        # q_nope: [B, S, H, qk_nope_head_dim] = [1, 4, 128, 128]
        q_nope = torch.randn(B, S, H, qk_nope)

        # wkv_b K-part: [H, qk_nope, kv_lora_rank] = [128, 128, 512]
        wkv_b_k = torch.randn(H, qk_nope, kv_lora_rank)

        # Absorb: q_nope @ wkv_b_k → [B, S, H, kv_lora_rank]
        q_absorbed = torch.einsum("bshd,hdc->bshc", q_nope, wkv_b_k)
        assert q_absorbed.shape == (B, S, H, kv_lora_rank)
        assert q_absorbed.shape[-1] == 512  # Compressed space

    def test_attention_in_compressed_space(self, v3_config):
        """
        Claim: scores = einsum("bshc,btc->bsht", q_absorbed, kv_cache)
        Attention computed directly on 512-dim compressed vectors.
        """
        B, S, T, H = 1, 4, 16, v3_config["n_heads"]
        kv_lora_rank = v3_config["kv_lora_rank"]

        q_absorbed = torch.randn(B, S, H, kv_lora_rank)
        kv_cache = torch.randn(B, T, kv_lora_rank)

        # This should produce attention scores [B, S, H, T]
        scores = torch.einsum("bshc,btc->bsht", q_absorbed, kv_cache)
        assert scores.shape == (B, S, H, T)

    def test_rope_separate_computation(self, v3_config):
        """
        Claim: Total score = nope_score + rope_score (two independent parts)
        """
        B, S, T, H = 1, 4, 16, v3_config["n_heads"]
        kv_lora_rank = v3_config["kv_lora_rank"]
        qk_rope = v3_config["qk_rope_head_dim"]

        # Nope part: in compressed space
        q_absorbed = torch.randn(B, S, H, kv_lora_rank)
        kv_cache = torch.randn(B, T, kv_lora_rank)
        nope_scores = torch.einsum("bshc,btc->bsht", q_absorbed, kv_cache)

        # Rope part: in 64-dim space
        q_pe = torch.randn(B, S, H, qk_rope)
        pe_cache = torch.randn(B, T, qk_rope)
        rope_scores = torch.einsum("bshr,btr->bsht", q_pe, pe_cache)

        # Both produce same shape, can be added
        assert nope_scores.shape == rope_scores.shape == (B, S, H, T)
        total_scores = nope_scores + rope_scores
        assert total_scores.shape == (B, S, H, T)
