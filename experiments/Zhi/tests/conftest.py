"""
Shared fixtures for DeepSeek architecture verification tests.

These parameters are extracted from the technical analysis document:
  deepseek-evolution-analysis-details.html

Sources:
  - DeepSeek-V3 Technical Report (arXiv:2412.19437)
  - DeepSeek-V3 / V3.2 official inference code
"""
import pytest


@pytest.fixture
def v3_config():
    """DeepSeek-V3 671B model configuration (Section 1.1)."""
    return {
        # Basic dimensions
        "dim": 7168,
        "n_heads": 128,
        "n_layers": 61,
        "n_dense_layers": 3,
        # MLA parameters
        "q_lora_rank": 1536,
        "kv_lora_rank": 512,
        "qk_nope_head_dim": 128,
        "qk_rope_head_dim": 64,
        "v_head_dim": 128,
        # MoE parameters (Section 5.1)
        "n_routed_experts": 256,
        "n_shared_experts": 1,
        "n_activated_experts": 8,
        "n_expert_groups": 8,
        "n_limited_groups": 4,
        "moe_inter_dim": 2048,
        "score_func": "sigmoid",
        "route_scale": 2.5,
    }


@pytest.fixture
def v32_config(v3_config):
    """DeepSeek-V3.2 additional parameters (Section 2.1)."""
    return {
        **v3_config,
        # Indexer parameters
        "index_n_heads": 64,
        "index_head_dim": 128,
        "index_topk": 2048,
        # Scale format
        "scale_fmt": "ue8m0",
    }


@pytest.fixture
def v4_config(v32_config):
    """DeepSeek-V4 attention parameters (Section 3.1)."""
    return {
        **v32_config,
        # CSA (C4) parameters
        "csa_compress_ratio": 4,
        "csa_topk": 512,
        # HCA (C128) parameters
        "hca_compress_ratio": 128,
        # SWA parameters
        "swa_window_size": 128,
        # MLA latent dim (kv_lora_rank + qk_rope_head_dim)
        "mla_cache_dim": 576,
    }


@pytest.fixture
def fp8_config():
    """FP8 quantization parameters (Section 6.2)."""
    return {
        "block_size": 128,
        "e4m3_max_value": 448.0,
        "scale_bits_ue8m0": 8,
        "scale_bits_float32": 32,
    }
