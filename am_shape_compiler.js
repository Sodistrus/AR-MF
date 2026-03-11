/**
 * Shape Compiler
 * แปลง shape grammar → field of particles
 * Direct equation-based generation
 */

class ShapeCompiler {
    constructor(canvasWidth, canvasHeight) {
        this.W = canvasWidth;
        this.H = canvasHeight;
        this.CX = canvasWidth / 2;
        this.CY = canvasHeight / 2;
    }

    /**
     * Main entry point: compile shape family + parameters → particle field
     */
    compileShapeField(control) {
        const pts = [];
        const n = control.constraints?.max_particles || 12000;
        const shape = control.morphology?.family || "sphere";

        for (let i = 0; i < n; i++) {
            let pos = {};

            // เลือกสมการตามรูปทรง
            switch (shape) {
                case "sphere":
                    pos = this._generateSphere(i, n, control);
                    break;
                case "spiral_vortex":
                    pos = this._generateSpiral(i, n, control);
                    break;
                case "flower_shell":
                    pos = this._generateFlower(i, n, control);
                    break;
                case "wave_ribbon":
                    pos = this._generateWaveRibbon(i, n, control);
                    break;
                case "nebula_cloud":
                    pos = this._generateNebula(i, n, control);
                    break;
                case "fracture_shell":
                    pos = this._generateFracture(i, n, control);
                    break;
                case "torus":
                    pos = this._generateTorus(i, n, control);
                    break;
                default:
                    pos = this._generateSphere(i, n, control);
            }

            if (pos.x !== undefined && pos.y !== undefined) {
                pts.push({
                    x: pos.x,
                    y: pos.y,
                    color: pos.color || control.optics?.primary_colors?.[0] || "#FFFFFF",
                    energy: pos.energy || 1.0
                });
            }
        }

        return pts;
    }

    // ============== SHAPE GENERATORS ==============

    _generateSphere(i, n, control) {
        const u = (Math.random() * Math.PI * 2);
        const v = (Math.random() * Math.PI);
        const r = Math.min(this.W, this.H) * 0.18;

        const x = this.CX + Math.cos(u) * Math.sin(v) * r;
        const y = this.CY + Math.cos(v) * r;

        return {
            x, y,
            color: control.optics?.primary_colors?.[0],
            energy: 1.0
        };
    }

    _generateSpiral(i, n, control) {
        const t = (i / n) * 10 * Math.PI;
        const r = 12 + i * 0.03;
        const twist = control.morphology?.complexity || 0.6;

        const x = this.CX + Math.cos(t) * r;
        const y = this.CY + Math.sin(t) * r * 0.55 * (0.8 + twist * 0.4);

        return {
            x, y,
            color: this._lerpColor(
                control.optics?.primary_colors?.[0],
                control.optics?.secondary_colors?.[0],
                i / n
            ),
            energy: 1.0 - (i / n) * 0.3
        };
    }

    _generateFlower(i, n, control) {
        const petal_count = control.morphology?.symmetry || 5;
        const t = (i / n) * Math.PI * 2;
        const petal_phase = (i % (n / petal_count)) / (n / petal_count) * Math.PI * 2;

        const r = 50 + 30 * Math.cos(petal_phase);
        const angle = (Math.floor(i / (n / petal_count)) / petal_count) * Math.PI * 2 + petal_phase;

        const x = this.CX + Math.cos(angle) * r;
        const y = this.CY + Math.sin(angle) * r;

        return {
            x, y,
            color: control.optics?.primary_colors?.[0],
            energy: Math.sin(petal_phase)
        };
    }

    _generateWaveRibbon(i, n, control) {
        const progress = (i / n);
        const wave_freq = control.morphology?.complexity || 0.5;

        const x = this.CX - this.W * 0.4 + progress * this.W * 0.8;
        const wave_y = Math.sin(progress * Math.PI * wave_freq * 4) * 40;
        const y = this.CY + wave_y;

        return {
            x, y,
            color: this._gradientColor(progress, control.optics),
            energy: Math.sin(progress * Math.PI)
        };
    }

    _generateNebula(i, n, control) {
        // Perlin noise-like distribution (simplified)
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() ** 0.5 * 150;  // concentrated toward center

        const x = this.CX + Math.cos(angle) * radius;
        const y = this.CY + Math.sin(angle) * radius;

        return {
            x, y,
            color: control.optics?.secondary_colors?.[0],
            energy: Math.random() * 0.8 + 0.2
        };
    }

    _generateFracture(i, n, control) {
        const burst_angle = Math.random() * Math.PI * 2;
        const burst_speed = Math.random() * 0.5 + 0.5;
        const fragment_radius = Math.random() * 80;

        const x = this.CX + Math.cos(burst_angle) * fragment_radius * burst_speed;
        const y = this.CY + Math.sin(burst_angle) * fragment_radius * burst_speed;

        return {
            x, y,
            color: control.optics?.primary_colors?.[0],
            energy: 1.0 - (i / n) * 0.5
        };
    }

    _generateTorus(i, n, control) {
        const major_radius = 80;
        const minor_radius = 30;
        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * Math.PI * 2;

        const x = this.CX + (major_radius + minor_radius * Math.cos(v)) * Math.cos(u);
        const y = this.CY + (major_radius + minor_radius * Math.cos(v)) * Math.sin(u);

        return {
            x, y,
            color: control.optics?.primary_colors?.[0],
            energy: Math.sin(v)
        };
    }

    // ============== HELPER METHODS ==============

    _lerpColor(hex1, hex2, t) {
        const c1 = this._hexToRgb(hex1);
        const c2 = this._hexToRgb(hex2);

        const r = Math.round(c1.r + (c2.r - c1.r) * t);
        const g = Math.round(c1.g + (c2.g - c1.g) * t);
        const b = Math.round(c1.b + (c2.b - c1.b) * t);

        return `rgb(${r},${g},${b})`;
    }

    _gradientColor(progress, optics) {
        if (!optics?.primary_colors?.length) return "#FFFFFF";
        return this._lerpColor(
            optics.primary_colors[0],
            optics.secondary_colors?.[0] || optics.primary_colors[0],
            progress
        );
    }

    _hexToRgb(hex) {
        if (hex.startsWith("rgb")) {
            const match = hex.match(/\d+/g);
            return { r: parseInt(match[0]), g: parseInt(match[1]), b: parseInt(match[2]) };
        }
        hex = hex.replace("#", "");
        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16)
        };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShapeCompiler;
}