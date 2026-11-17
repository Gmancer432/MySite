
const InitialStaticCode = `
        @group(0) @binding(0)
        var outputTexture : texture_storage_2d<rgba8unorm, write>;
		@group(0) @binding(1)
        var<uniform> window : vec2u;

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

            if (x >= window.x || y >= window.y) {
                return;
            }

            let randomValue =
                hash(x, y);

            let brightness =
                f32(randomValue & 255u) / 255.0;

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

let width = 800;
let height = 600;
let scrollX = 0;
let scrollY = 0;

// helpers for mobile tap scrolling
let lastPointerX = 0;
let lastPointerY = 0;
let velocityX = 0;
let velocityY = 0;
let lastPointerTime = 0;
let isDragging = false;
let animationFrame = null;
const friction = 0.95;
const stopThreshold = 0.1;

var device;
var windowBuffer;
var OnScroll;

var staticTexture;
var maskTexture;

const obj = {
	GetGpuDeviceAsync: async function(){
		if (!navigator.gpu) {
			document.body.innerHTML =
				"<h1>WebGPU is not supported by this browser.</h1>";
			return;
		}

		const adapter = await navigator.gpu.requestAdapter();

		if (!adapter) {
			document.body.innerHTML =
				"<h1>Could not get a GPU adapter.</h1>";
			return;
		}

		device = await adapter.requestDevice();
		return device;
	},
	InitCanvas: function(){
		// contains numbers related to scrolling (TODO: include window size)
		windowBuffer = device.createBuffer({
			size: 16,
			usage:
				GPUBufferUsage.UNIFORM |
				GPUBufferUsage.COPY_DST
		});

		// desktop scrolling helper
		const canvas = document.getElementById("canvas");
		canvas.addEventListener("wheel", (event) => {
			event.preventDefault();
			scrollX += Math.round(event.deltaX);
			scrollY += Math.round(event.deltaY);
			if(OnScroll) OnScroll(scrollX, scrollY);
		}, { passive: false });

		// mobile tap/drag helpers
		function startInertia() {
			// limit velocity during inertia
			velocityX = Math.min(velocityX, 100);
			velocityY = Math.min(velocityY, 100);
			if (animationFrame !== null) {
				cancelAnimationFrame(animationFrame);
			}

			let lastFrameTime = performance.now();

			function animate(currentTime) {
				const deltaTime = currentTime - lastFrameTime;
				lastFrameTime = currentTime;

				// Apply movement.
				scrollX += velocityX * deltaTime;
				scrollY += velocityY * deltaTime;

				// Apply friction.
				const frictionFactor = Math.pow(friction, deltaTime / 16.67);

				velocityX *= frictionFactor;
				velocityY *= frictionFactor;

				if(OnScroll) OnScroll(scrollX, scrollY);

				// Stop when movement becomes negligible.
				if (
					Math.abs(velocityX) < stopThreshold &&
					Math.abs(velocityY) < stopThreshold
				) {
					animationFrame = null;
					return;
				}

				animationFrame = requestAnimationFrame(animate);
			}

			animationFrame = requestAnimationFrame(animate);
		}
		canvas.addEventListener("pointerdown", (event) => {
			isDragging = true;

			lastPointerX = event.clientX;
			lastPointerY = event.clientY;
			lastPointerTime = performance.now();

			// Stop any existing momentum.
			velocityX = 0;
			velocityY = 0;

			if (animationFrame !== null) {
				cancelAnimationFrame(animationFrame);
				animationFrame = null;
			}

			canvas.setPointerCapture(event.pointerId);
		});
		canvas.addEventListener("pointermove", (event) => {
			if (!isDragging) return;

			const currentTime = performance.now();

			const deltaX = lastPointerX - event.clientX;
			const deltaY = lastPointerY - event.clientY;

			const deltaTime = currentTime - lastPointerTime;

			scrollX += Math.round(deltaX);
			scrollY += Math.round(deltaY);

			if (deltaTime > 0) {
				velocityX = deltaX / deltaTime;
				velocityY = deltaY / deltaTime;
			}

			lastPointerX = event.clientX;
			lastPointerY = event.clientY;
			lastPointerTime = currentTime;

			if(OnScroll) OnScroll(scrollX, scrollY);
		});
		canvas.addEventListener("pointerup", () => {
			isDragging = false;
			startInertia();
		});
		canvas.addEventListener("pointercancel", () => {
			isDragging = false;
			startInertia();
		});

		// determine dimensions of window
		var dpr = window.devicePixelRatio || 1; // ratio of screen pixels to css pixels
		width = canvas.clientWidth * dpr;
		height = canvas.clientHeight * dpr;
		const pixelCount = width * height;

		const maxPixels = 1500000;
		if (pixelCount > maxPixels) {
			const scale = Math.sqrt(maxPixels / pixelCount);

			width *= scale;
			height *= scale;
		}

		width = Math.floor(width);
		height = Math.floor(height);
		canvas.width = width;
		canvas.height = height;
		device.queue.writeBuffer(
			windowBuffer,
			8,
			new Uint32Array([
				width,
				height
			])
		);

		const context = canvas.getContext("webgpu");
		const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

		context.configure({
			device: device,
			format: canvasFormat
		});

		// this acts as the memory that the compute shader writes to, and the render shader reads from
		staticTexture = device.createTexture({
			size: [width, height],

			format: "rgba8unorm",

			usage:
				GPUTextureUsage.STORAGE_BINDING |
				GPUTextureUsage.TEXTURE_BINDING
		});

		/// do an iniital pass of the static onto the texture
		this.InitializeStatic();
		
		return [staticTexture, windowBuffer];
	},
	CreateMaskTexture(){
		maskTexture = device.createTexture({
			size: [width, height],
			format: "r8unorm",
			usage: GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_DST
		});

		var maskData = new Uint8Array(width * height);

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const dx = x - width / 2;
				const dy = y - height / 2;

				const distanceSquared = dx * dx + dy * dy;
				const radius = Math.min(width, height) / 2;

				if (distanceSquared <= radius * radius) {
					maskData[y * width + x] = 255;
				}
			}
		}

		this.UpdateMask(maskData)

		return [maskTexture, maskData]
	},
	UpdateMask(maskData){
		device.queue.writeTexture(
			{ texture: maskTexture },
			maskData,
			{ bytesPerRow: width },
			{
				width: width,
				height: height
			}
		);
	},
	async UpdateMaskFromImage(imgUrl, inverse=false){
		/// load image
		const image = new Image();
		image.src = imgUrl;
		await image.decode();

		/// create canvas to draw the image on
		const maskCanvas = document.createElement("canvas");
		maskCanvas.width = width;
		maskCanvas.height = height;
		const ctx = maskCanvas.getContext("2d");

		/// calculate scaling ratio, and offset needed to center it
		const scale = Math.min(
			width / image.width,
			height / image.height
		);

		const drawWidth = image.width * scale;
		const drawHeight = image.height * scale;

		const offsetX = (width - drawWidth) / 2;
		const offsetY = (height - drawHeight) / 2;

		/// draw onto the canvas
		ctx.drawImage(
			image,
			offsetX,
			offsetY,
			drawWidth,
			drawHeight
		);

		/// grab the pixel data from the canvas
		const imageData = ctx.getImageData(
			0,
			0,
			width,
			height
		);

		/// convert it into the format used by the WebGPU maskTexture
		const maskData = new Uint8Array(width * height);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				// each pixel has values for rgba, but for this we'll only use the alpha
				const sourceIndex = (y * width + x) * 4;
				const a = imageData.data[sourceIndex + 3];
				// convert to a scrict binary
				var masked = a > 128;
				if(inverse) masked = !masked
				maskData[y * width + x] = masked ? 255 : 0;
			}
		}

		// upload it to the texture
		this.UpdateMask(maskData);
	},
	InitializeStatic: function(){
		var InitialStaticShader = device.createShaderModule({ code: InitialStaticCode });
		const initialPipeline = device.createComputePipeline({
			layout: "auto",

			compute: {
				module: InitialStaticShader,
				entryPoint: "main"
			}
		});

		const initialWindowBuffer = device.createBuffer({
			size: 8,
			usage:
				GPUBufferUsage.UNIFORM |
				GPUBufferUsage.COPY_DST
		});
		device.queue.writeBuffer(
			initialWindowBuffer,
			0,
			new Uint32Array([
				width,
				height
			])
		);
		const initialBindGroup = device.createBindGroup({
			layout: initialPipeline.getBindGroupLayout(0),

			entries: [
				{
					binding: 0,
					resource: staticTexture.createView()
				},
				{
					binding: 1,
					resource: {
						buffer: initialWindowBuffer
					}
				}
			]
		});

		const initialCommandEncoder =
			device.createCommandEncoder();

		const initialPass =
			initialCommandEncoder.beginComputePass();

		initialPass.setPipeline(initialPipeline);
		initialPass.setBindGroup(0, initialBindGroup);

		initialPass.dispatchWorkgroups(
			Math.ceil(width / 8),
			Math.ceil(height / 8)
		);

		initialPass.end();

		device.queue.submit([
			initialCommandEncoder.finish()
		]);
	},
	RegisterScrollEvent: function(handler){
		OnScroll = handler;
	},
	UpdateWindowBuffer: function(){
		device.queue.writeBuffer(
			windowBuffer,
			0,
			new Int32Array([
				scrollX,
				scrollY
			])
		);
	}
}

export default obj;
