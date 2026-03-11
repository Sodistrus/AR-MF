"""
BioVisionNet Evaluator
ตรวจสอบว่า light manifestation ตรงกับคำขอผู้ใช้
closed-loop feedback control
"""

import numpy as np
from typing import Dict, Tuple, Any
from enum import Enum


class EvaluationMetric(Enum):
    SHAPE_READABILITY = "shape_readability"
    CONTRAST_SUFFICIENCY = "contrast_sufficiency"
    EMOTIONAL_MATCH = "emotional_match"
    TEMPORAL_COHERENCE = "temporal_coherence"
    NOISE_LEVEL = "noise_level"


class BioVisionNetEvaluator:
    """
    ใช้ principles จาก visual neuroscience
    - intensity preservation (luminance channels)
    - DoG filtering (difference of Gaussians)
    - edge orientation
    - temporal analysis
    """
    
    def __init__(self, frame_width: int = 1920, frame_height: int = 1080):
        self.width = frame_width
        self.height = frame_height
        self.prev_frame = None
        self.evaluation_history = []
    
    def evaluate_light_manifestation(self,
                                   framebuffer: np.ndarray,
                                   user_request: str,
                                   intent_packet: Dict[str, Any]) \
                                   -> Dict[str, float]:
        """
        วิเคราะห์ framebuffer ที่เรนเดอร์ออกมา
        ตรวจสอบ: readability, contrast, emotional match
        """
        
        metrics = {}
        
        # 1. Shape Readability
        metrics[EvaluationMetric.SHAPE_READABILITY.value] = \
            self._evaluate_shape_readability(framebuffer, intent_packet)
        
        # 2. Contrast Sufficiency
        metrics[EvaluationMetric.CONTRAST_SUFFICIENCY.value] = \
            self._evaluate_contrast(framebuffer)
        
        # 3. Emotional Match (perceptual loss)
        metrics[EvaluationMetric.EMOTIONAL_MATCH.value] = \
            self._evaluate_emotional_alignment(
                framebuffer, user_request, intent_packet
            )
        
        # 4. Temporal Coherence
        metrics[EvaluationMetric.TEMPORAL_COHERENCE.value] = \
            self._evaluate_temporal_coherence(framebuffer)
        
        # 5. Noise Assessment
        metrics[EvaluationMetric.NOISE_LEVEL.value] = \
            self._evaluate_noise_level(framebuffer)
        
        # Store history
        self.evaluation_history.append(metrics)
        self.prev_frame = framebuffer.copy()
        
        return metrics
    
    def _evaluate_shape_readability(self, 
                                  framebuffer: np.ndarray,
                                  intent_packet: Dict) -> float:
        """
        ตรวจสอบว่ารูปทรงที่ต้องการมองออกไหม
        ใช้ edge detection (DoG)
        """
        
        # Convert to grayscale
        if len(framebuffer.shape) == 3:
            gray = np.mean(framebuffer, axis=2)
        else:
            gray = framebuffer
        
        # Apply Difference of Gaussians (DoG)
        sigma1, sigma2 = 1.5, 3.0
        gaussian1 = self._gaussian_blur(gray, sigma1)
        gaussian2 = self._gaussian_blur(gray, sigma2)
        dog = gaussian1 - gaussian2
        
        # ความคมชัดของ edge
        edge_sharpness = np.std(dog)
        
        # ตรวจสอบ connectivity (particles grouped or scattered)
        connected_regions = self._count_connected_components(dog > 0.1)
        
        # คะแนน: ต่ำ = scattered, สูง = well-defined shape
        if connected_regions > 5:
            readability = max(0, 1 - (connected_regions / 20))  # too fragmented
        else:
            readability = min(1, edge_sharpness / 50)  # sharp edges
        
        return float(readability)
    
    def _evaluate_contrast(self, framebuffer: np.ndarray) -> float:
        """
        Color opponency + luminance contrast
        ใช้ DoG สำหรับสีและความสว่าง
        """
        
        if len(framebuffer.shape) == 3 and framebuffer.shape[2] >= 3:
            r, g, b = framebuffer[:,:,0], framebuffer[:,:,1], framebuffer[:,:,2]
            luminance = 0.299 * r + 0.587 * g + 0.114 * b
        else:
            luminance = framebuffer if len(framebuffer.shape) == 2 else np.mean(framebuffer, axis=2)
        
        # Contrast = std / mean
        mean_val = np.mean(luminance)
        std_val = np.std(luminance)
        
        if mean_val < 1e-3:
            return 0.0
        
        contrast = std_val / mean_val
        
        # ต้อง contrast ระหว่าง 0.3 - 0.8 ถึงดี
        if contrast < 0.2:
            return contrast / 0.2  # too low
        elif contrast > 0.8:
            return 1 - min((contrast - 0.8) / 0.5, 0.5)  # getting too high
        else:
            return min(1, contrast / 0.5)  # optimal range
    
    def _evaluate_emotional_alignment(self,
                                     framebuffer: np.ndarray,
                                     user_request: str,
                                     intent_packet: Dict) -> float:
        """
        Perceptual loss: ตรวจสอบว่า framebuffer "รู้สึก" ตรงกับคำขอ
        ใช้ color psychology + motion persistence
        """
        
        # Extract color from framebuffer
        if len(framebuffer.shape) == 3:
            avg_color = np.mean(framebuffer, axis=(0, 1))
        else:
            avg_color = np.array([np.mean(framebuffer)] * 3)
        
        # Expected color จาก intent
        expected_colors = intent_packet.get("optics", {}).get("primary_colors", ["#FFFFFF"])
        
        # คำนวณ color similarity
        color_match = self._evaluate_color_match(avg_color, expected_colors[0])
        
        # Evaluate emotional content (heuristic)
        luminance = np.mean(framebuffer)
        motion_intensity = self._evaluate_motion_intensity(framebuffer)
        
        # Combine: color + luminance + motion → emotional feeling
        emotional_score = (color_match * 0.4 + 
                          (luminance / 255.0) * 0.3 +
                          motion_intensity * 0.3)
        
        return float(emotional_score)
    
    def _evaluate_temporal_coherence(self, framebuffer: np.ndarray) -> float:
        """
        วิเคราะห์ motion flow และ stability
        ใช้ optical flow principles
        """
        
        if self.prev_frame is None:
            return 0.5  # no history
        
        # Frame difference
        diff = np.abs(framebuffer - self.prev_frame)
        motion_energy = np.sum(diff)
        
        # Normalize
        max_motion = framebuffer.shape[0] * framebuffer.shape[1] * 255 * 3
        normalized_motion = motion_energy / max_motion
        
        # ต้อง motion ระหว่าง 0.1 - 0.5 (ไม่นิ่ง แต่ก็ไม่บ้า)
        if normalized_motion < 0.05:
            return normalized_motion / 0.05  # too static
        elif normalized_motion > 0.6:
            return 1 - min((normalized_motion - 0.6) / 0.4, 0.5)  # too chaotic
        else:
            return min(1, normalized_motion / 0.3)
    
    def _evaluate_noise_level(self, framebuffer: np.ndarray) -> float:
        """
        Laplacian-based noise detection
        (high frequency = noise)
        """
        
        if len(framebuffer.shape) == 3:
            gray = np.mean(framebuffer, axis=2)
        else:
            gray = framebuffer
        
        # Laplacian
        laplacian = self._laplacian_filter(gray)
        
        # Noise = high-frequency energy
        noise_energy = np.std(laplacian)
        
        # ต้อง noise ต่ำ ไม่เกิน 20
        if noise_energy > 50:
            return 0.0
        else:
            return max(0, 1 - (noise_energy / 50))
    
    def suggest_runtime_adjustments(self, 
                                   metrics: Dict[str, float]) -> Dict[str, float]:
        """
        ตามผลลัพธ์ suggest ปรับแต่ง runtime parameters
        """
        
        adjustments = {}
        
        # ถ้า readability ต่ำ → เพิ่ม coherence
        if metrics.get("shape_readability", 0) < 0.4:
            adjustments["coherence"] = +0.15
        
        # ถ้า contrast ต่ำ → เพิ่ม brightness/glow
        if metrics.get("contrast_sufficiency", 0) < 0.5:
            adjustments["glow_strength"] = +0.2
            adjustments["luminance"] = +0.1
        
        # ถ้า noise สูง → ลด turbulence
        if metrics.get("noise_level", 0) > 0.3:
            adjustments["turbulence"] = -0.1
            adjustments["noise_level"] = -0.1
        
        # ถ้า motion ไม่พอ → เพิ่ม flow_magnitude
        if metrics.get("temporal_coherence", 0) < 0.3:
            adjustments["flow_magnitude"] = +0.2
        
        # ถ้า emotional match ต่ำ → อาจจำเป็นต้องเปลี่ยน render mode
        if metrics.get("emotional_match", 0) < 0.4:
            adjustments["render_mode_hint"] = "reconsider_visual_strategy"
        
        return adjustments
    
    # =============== Helper Methods ===============
    
    def _gaussian_blur(self, image: np.ndarray, sigma: float) -> np.ndarray:
        """Simple Gaussian blur approximation"""
        kernel_size = int(sigma * 3) * 2 + 1
        kernel = self._gaussian_kernel(kernel_size, sigma)
        # สมมติว่า convolve already available
        return image  # simplified
    
    def _gaussian_kernel(self, size: int, sigma: float) -> np.ndarray:
        """สร้าง Gaussian kernel"""
        x = np.arange(size) - size // 2
        y = np.arange(size) - size // 2
        X, Y = np.meshgrid(x, y)
        kernel = np.exp(-(X**2 + Y**2) / (2 * sigma**2))
        return kernel / np.sum(kernel)
    
    def _laplacian_filter(self, image: np.ndarray) -> np.ndarray:
        """Laplacian edge detection"""
        kernel = np.array([[0, -1, 0], [-1, 4, -1], [0, -1, 0]])
        # simplified - would need proper convolution
        return image
    
    def _count_connected_components(self, binary_image: np.ndarray) -> int:
        """Count connected regions (simplified)"""
        return int(np.sum(binary_image) / 100)  # rough estimate
    
    def _evaluate_color_match(self, avg_color: np.ndarray, hex_color: str) -> float:
        """เปรียบเทียบสีตัวจริงกับสีคาดหวัง"""
        target = self._hex_to_rgb(hex_color)
        distance = np.linalg.norm(avg_color - target)
        return max(0, 1 - (distance / 255))
    
    def _hex_to_rgb(self, hex_color: str) -> np.ndarray:
        """แปลง #HEX → RGB array"""
        hex_color = hex_color.lstrip("#")
        return np.array([
            int(hex_color[0:2], 16),
            int(hex_color[2:4], 16),
            int(hex_color[4:6], 16)
        ])
    
    def _evaluate_motion_intensity(self, framebuffer: np.ndarray) -> float:
        """ประมาณ motion intensity จาก particle dispersion"""
        return min(1, np.mean(framebuffer) / 200)


# Example usage
if __name__ == "__main__":
    evaluator = BioVisionNetEvaluator(frame_width=1920, frame_height=1080)
    
    # Dummy framebuffer
    dummy_frame = np.random.rand(1080, 1920, 3) * 100 + 100
    
    intent_packet = {
        "optics": {
            "primary_colors": ["#7C3AED"]
        }
    }
    
    metrics = evaluator.evaluate_light_manifestation(
        framebuffer=dummy_frame,
        user_request="spiral of contemplation",
        intent_packet=intent_packet
    )
    
    print("Evaluation Metrics:", metrics)
    
    adjustments = evaluator.suggest_runtime_adjustments(metrics)
    print("Suggested Adjustments:", adjustments)