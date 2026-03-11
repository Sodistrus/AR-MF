/**
 * Control Handler v3.0
 * Replace hard-coded FSM triggers with dynamic light control
 */

class ControlHandlerV3 {
    constructor(kernel, shapeCo compiler, evaluator) {
        this.Kernel = kernel;
        this.ShapeCompiler = shapeCompiler;
        this.Evaluator = evaluator;
        this.currentControl = null;
    }

    /**
     * Main entry: handle user light request (เป็นฟังก์ชันที่เรียกเมื่อผู้ใช้พูด)
     */
    async handleUserLightRequest(userText) {
        try {
            // ขั้นที่ 1: Intent Interpretation
            const intendPacket = await this.IntentInterpreter.parse_user_request(userText);
            console.log("[Intent]", intendPacket);

            // ขั้นที่ 2: Formation Retrieval + Morphology Compilation
            const runtimeControl = this.FormationRetriever
                .compile_morphology_to_runtime_control(intendPacket);
            console.log("[Runtime Control]", runtimeControl);

            // ขั้นที่ 3: Apply Control
            this.applyRuntimeControl(intendPacket, runtimeControl);

            // ขั้นที่ 4: Start Evaluation Loop (closed-loop)
            this.startEvaluationLoop(intendPacket);

        } catch (error) {
            console.error("[ControlHandler Error]", error);
        }
    }

    /**
     * Apply LCL control packet to Kernel
     */
    applyRuntimeControl(intendPacket, runtimeControl) {
        const morphology = intendPacket.morphology;
        const motion = intendPacket.motion;
        const optics = intendPacket.optics;
        const fieldRecipe = runtimeControl.field_recipe;

        // ตั้ง render mode
        const renderMode = runtimeControl.render_mode;

        // สร้าง target field ตามรูปทรง
        if (renderMode === "particle_sdf_proxy") {
            this.Kernel.targetField = this.ShapeCompiler.compileShapeField(intendPacket);
        } else if (renderMode === "particle_shatter") {
            // ใช้สมการ fracture
            this.Kernel.targetField = this.ShapeCompiler._generateFracture(0, 12000, intendPacket);
        }

        // ตั้ง physics parameters
        this.Kernel.coherence = fieldRecipe.coherence_target;
        this.Kernel.turbulence = fieldRecipe.turbulence;
        this.Kernel.flowMag = fieldRecipe.flow_magnitude || 0.5;
        this.Kernel.vorticity = fieldRecipe.vorticity || 0.0;

        // ตั้ง timing
        const timing = runtimeControl.timing_envelope;
        this.Kernel.attackMs = timing.attack_ms;
        this.Kernel.holdMs = timing.hold_ms;
        this.Kernel.releaseMs = timing.release_ms;

        // ตั้ง visual
        const visual = runtimeControl.visual_recipe;
        this.Kernel.primaryColor = visual.primary_color;
        this.Kernel.secondaryColor = visual.secondary_color;
        this.Kernel.glowStrength = visual.glow_strength;
        this.Kernel.luminance = visual.luminance;

        // Trigger FSM transition (smooth)
        this.Kernel.transitionTo("MANIFEST", {
            morphology,
            motion,
            optics
        });

        this.currentControl = intendPacket;
    }

    /**
     * Closed-loop evaluation: ทุก N เฟรม ตรวจสอบและปรับแต่ง
     */
    startEvaluationLoop(intendPacket) {
        let frameCounter = 0;
        const evaluationInterval = 30;  // ตรวจทุก 30 เฟรม

        const evalLoop = () => {
            frameCounter++;

            if (frameCounter % evaluationInterval === 0) {
                // Capture framebuffer
                const framebuffer = this.Kernel.captureFramebuffer();

                // Evaluate
                const metrics = this.Evaluator.evaluate_light_manifestation(
                    framebuffer,
                    intendPacket.intent.user_request,
                    intendPacket
                );

                console.log("[Evaluation]", metrics);

                // Suggest adjustments
                const adjustments = this.Evaluator.suggest_runtime_adjustments(metrics);

                if (Object.keys(adjustments).length > 0) {
                    console.log("[Adjustments]", adjustments);
                    this.applyAdjustments(adjustments);
                }
            }

            // Continue loop
            if (this.Kernel.isManifesting) {
                requestAnimationFrame(evalLoop);
            }
        };

        requestAnimationFrame(evalLoop);
    }

    /**
     * Apply runtime adjustments from evaluator
     */
    applyAdjustments(adjustments) {
        if (adjustments.coherence !== undefined) {
            this.Kernel.coherence = Math.max(0, Math.min(1, 
                this.Kernel.coherence + adjustments.coherence
            ));
        }

        if (adjustments.glow_strength !== undefined) {
            this.Kernel.glowStrength = Math.max(0, Math.min(1,
                this.Kernel.glowStrength + adjustments.glow_strength
            ));
        }

        if (adjustments.luminance !== undefined) {
            this.Kernel.luminance = Math.max(0, Math.min(1,
                this.Kernel.luminance + adjustments.luminance
            ));
        }

        if (adjustments.turbulence !== undefined) {
            this.Kernel.turbulence = Math.max(0, Math.min(0.8,
                this.Kernel.turbulence + adjustments.turbulence
            ));
        }

        if (adjustments.flow_magnitude !== undefined) {
            this.Kernel.flowMag = Math.max(0, Math.min(1,
                this.Kernel.flowMag + adjustments.flow_magnitude
            ));
        }

        if (adjustments.noise_level !== undefined) {
            this.Kernel.noiseLevel = Math.max(0, Math.min(1,
                this.Kernel.noiseLevel + adjustments.noise_level
            ));
        }
    }
}

// Integration with existing code
// ในไฟล์ index.html เพิ่ม:
/*
const controlHandler = new ControlHandlerV3(Kernel, ShapeCompiler, Evaluator);

// เมื่อผู้ใช้พูด (จาก speech API หรือ text input)
userInput.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userText = userInput.value;
    await controlHandler.handleUserLightRequest(userText);
});
*/