var ComputeShaderCode = `
        @group(0) @binding(0)
        var outputTexture : texture_storage_2d<rgba8unorm, write>;

        struct WindowParameters {
            scroll     : vec2i,
            screenSize : vec2u
        };
        @group(0) @binding(1)
        var<uniform> windowParams : WindowParameters;
        @group(0) @binding(2)
        var maskTexture : texture_2d<f32>;

        // --------------------------------------------------------
        // Deterministic hash
        //
        // Same input -> same output
        // Different input -> seemingly random output
        // --------------------------------------------------------

        fn hash(x: u32, y: u32) -> u32 {

            var h = x * 374761393u
                    + y * 668265263u;

            h = (h ^ (h >> 13u)) * 1274126177u;
            h = h ^ (h >> 16u);

            return h;
        }


        @compute @workgroup_size(8, 8)
        fn main(
            @builtin(global_invocation_id) id : vec3u
        ) {

            let x = id.x;
            let y = id.y;

            if (x >= windowParams.screenSize.x || y >= windowParams.screenSize.y) {
                return;
            }

            let maskValue = textureLoad(
                maskTexture,
                vec2u(x, y),
                0
            ).r;

            if (maskValue > 0.5) {
                return;
            }

            // Get a deterministic pseudo-random value.
            let randomValue =
                hash(
                    x + u32(windowParams.scroll.x),
                    y + u32(windowParams.scroll.y)
                );


            // Convert the low 8 bits into
            // a value between 0 and 1.
            var brightness =
                f32(randomValue & 255u) / 255.0;

            // Add darkness based on scroll distance
            if (windowParams.scroll.y > 0) {
                brightness -= f32(windowParams.scroll.y) / f32(100000);
            }
            
            textureStore(
                outputTexture,

                vec2i(
                    i32(x),
                    i32(y)
                ),

                vec4f(
                    brightness,
                    brightness,
                    brightness,
                    1.0
                )
            );
        }
    `;
var device;
var computeShader;
var computePipeline;
var texture;
var maskTexture;
var bindGroup;

var maskX = 600;
var maskY = 300;
var maskRadius = 100;



const config = {
    InitComputeShader: function(deviceIn, textureIn, maskTextureIn, windowBuffer){
        device = deviceIn;
        texture = textureIn;
        maskTexture = maskTextureIn;

        // holds the code for the gpu to run
        computeShader = device.createShaderModule({ code: ComputeShaderCode });
        // runs the shader
        computePipeline = device.createComputePipeline({
            layout: "auto",

            compute: {
                module: computeShader,
                entryPoint: "main"
            }
        });

        // binds it all together
        bindGroup = device.createBindGroup({
            layout: computePipeline.getBindGroupLayout(0),

            entries: [
                {
                    binding: 0,
                    resource: texture.createView()
                },
                {
                    binding: 1,
                    resource: {
                        buffer: windowBuffer
                    }
                },
                {
                    binding: 2,
                    resource: maskTexture.createView()
                }
            ]
        });
    },
    DoWork: function(){
        const computeCommandEncoder =
        device.createCommandEncoder();

        const computePass =
            computeCommandEncoder.beginComputePass();

        computePass.setPipeline(computePipeline);
        computePass.setBindGroup(0, bindGroup);

        computePass.dispatchWorkgroups(
            Math.ceil(texture.width / 8),
            Math.ceil(texture.height / 8)
        );

        computePass.end();

        device.queue.submit([
            computeCommandEncoder.finish()
        ]);
    }
};
export default config;
