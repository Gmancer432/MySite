import WebGpuHelper from './WebGpuHelper.js';
import ComputeShaderHelper from './ComputeShader.js';
import RenderShaderHelper from './RenderShader.js';

async function main() {

    // Get access to WebGPU
    const device = await WebGpuHelper.GetGpuDeviceAsync();
    // Load the canvas and window buffer, create the texture memory, initialize the texture with static
    const [texture, windowBuffer] = WebGpuHelper.InitCanvas();
    // Create the mask and load it into the mask buffer
    const [maskTexture, maskData] = WebGpuHelper.CreateMaskTexture();
    await WebGpuHelper.UpdateMaskFromImage('deltarune_tree.png');
    // Load the compute shader, which loads pixels onto the texture
    ComputeShaderHelper.InitComputeShader(device, texture, maskTexture, windowBuffer);
    // Load the render shader, which renders the texture onto the canvas
    RenderShaderHelper.InitRenderShader(device, texture);

    var hitMaskClear = false;
    var hitMaskChange = false;

    function render(scrollX, scrollY) {
        WebGpuHelper.UpdateWindowBuffer();
        ComputeShaderHelper.DoWork();
        RenderShaderHelper.DoWork();

        if(!hitMaskClear && scrollY > 100000){
            hitMaskClear = true;
            WebGpuHelper.UpdateMaskFromImage('clearmask.png');
            return;
        }
        if(hitMaskClear && !hitMaskChange) {
            hitMaskChange = true;
            WebGpuHelper.UpdateMaskFromImage('shattered.png', true);
        }
    }

    WebGpuHelper.RegisterScrollEvent(render);

    render();
}

main();