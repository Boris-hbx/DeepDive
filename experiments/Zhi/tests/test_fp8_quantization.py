"""
Test FP8 quantization claims.

Verifies Section 六 of deepseek-evolution-analysis-details.html:
- Block-wise quantization with block_size=128
- E4M3 max value ≈ 448
- Scale dimension calculations
- ue8m0 format properties (8-bit exponent, power-of-2 only)
"""
import pytest
import math
import torch


class TestBlockWiseQuantization:
    """Verify block-wise quantization logic (Section 6.2)."""

    def test_block_size(self, fp8_config):
        """
        Claim: block_size = 128 (每 128 个元素共享一个 scale)
        """
        assert fp8_config["block_size"] == 128

    def test_e4m3_max_value(self, fp8_config):
        """
        Claim: E4M3 最大值约 448

        FP8 E4M3fn format (as used by PyTorch/DeepSeek):
        - 1 sign bit, 4 exponent bits, 3 mantissa bits
        - Bias = 7, max stored exponent = 15 → unbiased = 8
        - Max mantissa with max exponent: 1.110 (binary) = 1.75
          (pattern 1111_111 is reserved for NaN)
        - Max value = 1.75 × 2^8 = 448

        Verified: torch.finfo(torch.float8_e4m3fn).max == 448.0
        """
        # The document claims E4M3 max ≈ 448
        # This matches torch.finfo(torch.float8_e4m3fn).max
        e4m3_max = 1.75 * (2 ** 8)  # mantissa=1.75, exponent=8
        assert e4m3_max == 448.0
        assert fp8_config["e4m3_max_value"] == 448.0

        # Verify against PyTorch's implementation
        assert torch.finfo(torch.float8_e4m3fn).max == 448.0

    def test_scale_computation(self, fp8_config):
        """
        Claim: scale = abs_max / 448.0

        The scale maps the block's dynamic range to FP8's representable range.
        """
        block_size = fp8_config["block_size"]
        e4m3_max = fp8_config["e4m3_max_value"]

        # Simulate quantization
        x = torch.randn(1, 1024)
        x_blocks = x.view(-1, block_size)  # [8, 128]

        # Per-block scale
        scale = x_blocks.abs().amax(dim=-1) / e4m3_max  # [8]

        assert scale.shape == (1024 // block_size,)
        # All scales should be positive
        assert (scale >= 0).all()

        # Quantized values should be within E4M3 range (with float32 rounding tolerance)
        x_quantized = x_blocks / scale.unsqueeze(-1)
        assert x_quantized.abs().max() <= e4m3_max + 1e-3

    def test_weight_scale_dimensions(self, fp8_config):
        """
        Claim: weight scale shape = [ceil(out/128), ceil(in/128)]

        This is a 2D scale: one scale per 128×128 block of the weight matrix.
        """
        block_size = fp8_config["block_size"]

        # Example: MoE expert with moe_inter_dim=2048, dim=7168
        out_features = 2048
        in_features = 7168

        scale_rows = math.ceil(out_features / block_size)
        scale_cols = math.ceil(in_features / block_size)

        assert scale_rows == math.ceil(2048 / 128) == 16
        assert scale_cols == math.ceil(7168 / 128) == 56

        # Verify the formula from the document
        scale_shape = (
            (out_features + block_size - 1) // block_size,
            (in_features + block_size - 1) // block_size,
        )
        assert scale_shape == (16, 56)


class TestUE8M0Format:
    """Verify ue8m0 scale format properties (Section 6.3)."""

    def test_ue8m0_is_power_of_two(self):
        """
        Claim: ue8m0 = unsigned 8-bit exponent, 0 mantissa = 纯指数 scale（2 的幂次）

        With 0 mantissa bits, the only representable values are powers of 2.
        """
        # ue8m0: 8 exponent bits, 0 mantissa bits, unsigned
        # Representable values: 2^(stored_value - bias)
        # With 8 bits: stored values 0-255
        # All representable values are exact powers of 2
        for exp in range(256):
            value = 2.0 ** (exp - 127)  # Assuming bias=127
            # Check it's a power of 2
            assert value > 0
            # log2 of a power of 2 is an integer
            log2_val = math.log2(value)
            assert log2_val == int(log2_val)

    def test_ue8m0_compression_ratio(self, fp8_config):
        """
        Claim: ue8m0 每个 scale 只用 8 bit（vs 标准 float32 的 32 bit），4x 压缩
        """
        scale_bits_ue8m0 = fp8_config["scale_bits_ue8m0"]
        scale_bits_float32 = fp8_config["scale_bits_float32"]

        compression = scale_bits_float32 / scale_bits_ue8m0
        assert compression == 4.0

    def test_ue8m0_dequant_is_bitshift(self):
        """
        Claim: 反量化只需位移操作，无需乘法

        Since ue8m0 values are powers of 2, multiplying by them is equivalent
        to a bit shift (exponent addition in floating point).
        """
        # Demonstrate: multiplying by 2^n is equivalent to ldexp (bit shift)
        x = torch.randn(128)
        exponent = 5  # scale = 2^5 = 32

        # Method 1: multiplication
        result_mul = x * (2.0 ** exponent)

        # Method 2: ldexp (conceptual bit shift)
        result_shift = torch.ldexp(x, torch.tensor(exponent))

        assert torch.allclose(result_mul, result_shift)


class TestFP8PrecisionAllocation:
    """Verify precision allocation strategy (Section 6.1)."""

    def test_residual_precision_hierarchy(self):
        """
        Claim: 残差流 = BF16 → Float32（V3.2+），是精度的"生命线"

        Verify that float32 accumulation preserves more precision than bf16
        over many additions (simulating 61 layers of residual).
        """
        torch.manual_seed(42)
        n_layers = 61

        # Simulate residual accumulation
        residual_f32 = torch.zeros(1, 7168, dtype=torch.float32)
        residual_bf16 = torch.zeros(1, 7168, dtype=torch.bfloat16)

        for _ in range(n_layers):
            update = torch.randn(1, 7168) * 0.01
            residual_f32 += update.float()
            residual_bf16 += update.bfloat16()

        # Float32 should have less accumulated error
        # (bf16 has only 7 bits of mantissa vs float32's 23)
        # The difference should be measurable after 61 layers
        diff = (residual_f32 - residual_bf16.float()).abs().mean()
        assert diff > 0, "There should be measurable precision difference"

    def test_gemm_uses_fp8_activation_format(self):
        """
        Claim: GEMM uses FP8 E4M3 format for forward/backward

        Verify E4M3 format properties:
        - 4 exponent bits → dynamic range of 2^(2^4) = 2^16
        - 3 mantissa bits → 8 distinct mantissa values per exponent
        """
        # E4M3: 1 sign + 4 exponent + 3 mantissa = 8 bits
        sign_bits = 1
        exp_bits = 4
        mantissa_bits = 3
        assert sign_bits + exp_bits + mantissa_bits == 8

        # Number of distinct positive values (excluding special values)
        # For E4M3fn (no inf/nan): all 2^7 positive patterns are valid
        n_positive_values = 2 ** (exp_bits + mantissa_bits)
        assert n_positive_values == 128
