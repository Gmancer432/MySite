
const RenderShaderCode = `
        @group(0) @binding(0)
        var staticTexture : texture_2d<f32>;

        @vertex
        fn vertexMain(
            @builtin(vertex_index) vertexIndex: u32
        ) -> @builtin(position) vec4f {

            var positions = array<vec2f, 3>(
                vec2f(-1.0, -1.0),
                vec2f( 3.0, -1.0),
                vec2f(-1.0,  3.0)
            );

            return vec4f(
                positions[vertexIndex],
                0.0,
                1.0
            );
        }

        @fragment
        fn fragmentMain(
            @builtin(position) position: vec4f
        ) -> @location(0) vec4f {

            let pixel = vec2i(position.xy);

            return textureLoad(
                staticTexture,
                pixel,
                0
            );
        }
    `;

var device;
var texture;
var canvas;
var context;
var renderShader;
var renderPipeline;
var renderBindGroup;

const config = {
    InitRenderShader: function(deviceIn, textureIn){
        device = deviceIn;
        texture = textureIn;
        canvas = document.getElementById("canvas");
        context = canvas.getContext("webgpu");
		const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

        renderShader = device.createShaderModule({ code: RenderShaderCode });

        renderPipeline = device.createRenderPipeline({
            layout: "auto",

            vertex: {
                module: renderShader,
                entryPoint: "vertexMain"
            },

            fragment: {
                module: renderShader,
                entryPoint: "fragmentMain",

                targets: [
                    {
                        format: canvasFormat
                    }
                ]
            }
        });

        renderBindGroup = device.createBindGroup({
            layout: renderPipeline.getBindGroupLayout(0),

            entries: [
                {
                    binding: 0,
                    resource: texture.createView()
                }
            ]
        });
    },
    DoWork(){
        const renderCommandEncoder =
        device.createCommandEncoder();

    const renderPass =
        renderCommandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view:
                        context
                            .getCurrentTexture()
                            .createView(),

                    loadOp: "clear",

                    clearValue: {
                        r: 0,
                        g: 0,
                        b: 0,
                        a: 1
                    },

                    storeOp: "store"
                }
            ]
        });

        renderPass.setPipeline(renderPipeline);
        renderPass.setBindGroup(0, renderBindGroup);

        renderPass.draw(3);

        renderPass.end();

        device.queue.submit([
            renderCommandEncoder.finish()
        ]);
    }
};

export default config;