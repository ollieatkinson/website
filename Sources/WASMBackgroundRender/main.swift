import JavaScriptEventLoop
import JavaScriptKit

JavaScriptEventLoop.installGlobalExecutor()

private let assetVersion = "20260504-pointer-y"

private final class WebGPUBackground: @unchecked Sendable {
    private let global = JSObject.global
    private let canvas: JSObject
    private var pointerX = 0.5
    private var pointerY = 0.5
    private var pointerEnergy = 0.0
    private var lastFrame = 0.0
    private var animationFrame: JSClosure?
    private var pointerMove: JSClosure?
    private var pointerDown: JSClosure?
    private var pointerLeave: JSClosure?

    init?(canvasID: String) {
        let document = global.document.object!
        guard let canvas = document.getElementById!(canvasID).object else {
            return nil
        }

        self.canvas = canvas
    }

    func start() {
        guard global.navigator.object?.gpu.object != nil else {
            canvas.dataset.rendering = .string("css")
            return
        }

        installInputHandlers()

        Task {
            do {
                try await startWebGPU()
            } catch {
                canvas.dataset.rendering = .string("css")
                _ = global.console.warn("SwiftWasm WebGPU background failed:", "\(error)")
            }
        }
    }

    private func installInputHandlers() {
        pointerMove = JSClosure { [weak self] arguments in
            self?.updatePointer(arguments)
            return .undefined
        }

        pointerDown = JSClosure { [weak self] arguments in
            self?.updatePointer(arguments)
            self?.pointerEnergy = 1.0
            return .undefined
        }

        pointerLeave = JSClosure { [weak self] _ in
            self?.pointerEnergy = 0.0
            return .undefined
        }

        if let pointerMove {
            _ = global.window.addEventListener("pointermove", pointerMove)
        }

        if let pointerDown {
            _ = global.window.addEventListener("pointerdown", pointerDown)
        }

        if let pointerLeave {
            _ = global.window.addEventListener("pointerleave", pointerLeave)
        }
    }

    private func updatePointer(_ arguments: [JSValue]) {
        guard let event = arguments.first?.object else {
            return
        }

        let width = max(1.0, global.window.innerWidth.number ?? 1.0)
        let height = max(1.0, global.window.innerHeight.number ?? 1.0)

        pointerX = (event.clientX.number ?? width * 0.5) / width
        pointerY = (event.clientY.number ?? height * 0.5) / height
        pointerEnergy = 1.0
    }

    private func startWebGPU() async throws {
        let navigator = global.navigator.object!
        let gpu = navigator.gpu.object!
        let shaderSource = try await loadShaderSource()
        let adapterValue = try await JSPromise(gpu.requestAdapter!().object!)!.value
        guard let adapter = adapterValue.object else {
            throw BackgroundError.webGPUNotAvailable
        }

        let deviceValue = try await JSPromise(adapter.requestDevice!().object!)!.value
        guard let device = deviceValue.object else {
            throw BackgroundError.webGPUNotAvailable
        }

        let context = canvas.getContext!("webgpu")
        let format = gpu.getPreferredCanvasFormat!()
        let configuration = makeObject()
        configuration.device = .object(device)
        configuration.format = format
        configuration.alphaMode = .string("premultiplied")
        _ = context.configure(configuration)

        let shaderDescriptor = makeObject()
        shaderDescriptor.label = .string("olbo background shader")
        shaderDescriptor.code = .string(shaderSource)
        let shaderModule = device.createShaderModule!(shaderDescriptor)

        let pipelineDescriptor = makeObject()
        pipelineDescriptor.label = .string("olbo background pipeline")
        pipelineDescriptor.layout = .string("auto")
        pipelineDescriptor.vertex = .object(makeStage(module: shaderModule, entryPoint: "vertexMain"))

        let fragmentStage = makeStage(module: shaderModule, entryPoint: "fragmentMain")
        let target = makeObject()
        target.format = format
        fragmentStage.targets = .object(makeArray(target))
        pipelineDescriptor.fragment = .object(fragmentStage)

        let pipeline = device.createRenderPipeline!(pipelineDescriptor)
        let uniformBuffer = makeUniformBuffer(device: device)
        let bindGroup = makeBindGroup(device: device, pipeline: pipeline, uniformBuffer: uniformBuffer)
        let uniformArray = JSTypedArray<Float32>(length: 8)

        installRenderLoop(
            device: device,
            context: context.object!,
            pipeline: pipeline.object!,
            uniformBuffer: uniformBuffer.object!,
            uniformArray: uniformArray,
            bindGroup: bindGroup.object!
        )
    }

    private func loadShaderSource() async throws -> String {
        let fetch = global.fetch.object!
        let responseValue = try await JSPromise(fetch("/background.wgsl?v=\(assetVersion)").object!)!.value
        guard let response = responseValue.object else {
            throw BackgroundError.shaderLoadFailed
        }

        let textValue = try await JSPromise(response.text!().object!)!.value
        guard let source = textValue.string else {
            throw BackgroundError.shaderLoadFailed
        }

        return source
    }

    private func makeStage(module: JSValue, entryPoint: String) -> JSObject {
        let stage = makeObject()
        stage.module = module
        stage.entryPoint = .string(entryPoint)
        return stage
    }

    private func makeUniformBuffer(device: JSObject) -> JSValue {
        let descriptor = makeObject()
        descriptor.label = .string("olbo uniforms")
        descriptor.size = .number(32)
        descriptor.usage = .number(Double(0x0040 | 0x0008))
        return device.createBuffer!(descriptor)
    }

    private func makeBindGroup(device: JSObject, pipeline: JSValue, uniformBuffer: JSValue) -> JSValue {
        let bindingResource = makeObject()
        bindingResource.buffer = uniformBuffer

        let entry = makeObject()
        entry.binding = .number(0)
        entry.resource = .object(bindingResource)

        let descriptor = makeObject()
        descriptor.layout = pipeline.object!.getBindGroupLayout!(0)
        descriptor.entries = .object(makeArray(entry))
        return device.createBindGroup!(descriptor)
    }

    private func installRenderLoop(
        device: JSObject,
        context: JSObject,
        pipeline: JSObject,
        uniformBuffer: JSObject,
        uniformArray: JSTypedArray<Float32>,
        bindGroup: JSObject
    ) {
        animationFrame = JSClosure { [weak self] arguments in
            guard let self else {
                return .undefined
            }

            let time = (arguments.first?.number ?? 0) * 0.001
            self.drawFrame(
                time: time,
                device: device,
                context: context,
                pipeline: pipeline,
                uniformBuffer: uniformBuffer,
                uniformArray: uniformArray,
                bindGroup: bindGroup
            )

            if let animationFrame = self.animationFrame {
                _ = self.global.window.requestAnimationFrame(animationFrame)
            }

            return .undefined
        }

        if let animationFrame {
            _ = global.window.requestAnimationFrame(animationFrame)
        }
    }

    private func drawFrame(
        time: Double,
        device: JSObject,
        context: JSObject,
        pipeline: JSObject,
        uniformBuffer: JSObject,
        uniformArray: JSTypedArray<Float32>,
        bindGroup: JSObject
    ) {
        resizeCanvasIfNeeded()

        let width = max(1.0, canvas.width.number ?? 1.0)
        let height = max(1.0, canvas.height.number ?? 1.0)
        let delta = lastFrame == 0 ? 1.0 / 60.0 : min(0.08, max(0.0, time - lastFrame))
        lastFrame = time
        pointerEnergy = max(0, pointerEnergy - delta * 0.34)

        uniformArray[0] = Float32(time)
        uniformArray[1] = Float32(width)
        uniformArray[2] = Float32(height)
        uniformArray[3] = Float32(pointerX)
        uniformArray[4] = Float32(pointerY)
        uniformArray[5] = Float32(pointerEnergy)
        uniformArray[6] = 0
        uniformArray[7] = 0

        _ = device.queue.writeBuffer(uniformBuffer, 0, uniformArray)

        let texture = context.getCurrentTexture!().object!
        let textureView = texture.createView!()
        let colorAttachment = makeObject()
        colorAttachment.view = textureView
        colorAttachment.loadOp = .string("clear")
        colorAttachment.storeOp = .string("store")
        colorAttachment.clearValue = .object(makeColor(red: 0.02, green: 0.027, blue: 0.04, alpha: 1))

        let renderPassDescriptor = makeObject()
        renderPassDescriptor.colorAttachments = .object(makeArray(colorAttachment))

        let commandEncoder = device.createCommandEncoder!().object!
        let passEncoder = commandEncoder.beginRenderPass!(renderPassDescriptor).object!
        _ = passEncoder.setPipeline!(pipeline)
        _ = passEncoder.setBindGroup!(0, bindGroup)
        _ = passEncoder.draw!(3)
        _ = passEncoder.end!()
        _ = device.queue.submit(makeArray(commandEncoder.finish!().object!))
    }

    private func resizeCanvasIfNeeded() {
        let pixelRatio = min(2.0, max(1.0, global.window.devicePixelRatio.number ?? 1.0))
        let width = max(1.0, global.window.innerWidth.number ?? 1.0)
        let height = max(1.0, global.window.innerHeight.number ?? 1.0)
        let pixelWidth = (width * pixelRatio).rounded(.down)
        let pixelHeight = (height * pixelRatio).rounded(.down)

        if canvas.width.number != pixelWidth {
            canvas.width = .number(pixelWidth)
        }

        if canvas.height.number != pixelHeight {
            canvas.height = .number(pixelHeight)
        }

        canvas.style.width = .string("\(Int(width))px")
        canvas.style.height = .string("\(Int(height))px")
    }

    private func makeColor(red: Double, green: Double, blue: Double, alpha: Double) -> JSObject {
        let color = makeObject()
        color.r = .number(red)
        color.g = .number(green)
        color.b = .number(blue)
        color.a = .number(alpha)
        return color
    }

    private func makeObject() -> JSObject {
        JSObject.global.Object.object!.new()
    }

    private func makeArray(_ value: JSObject) -> JSObject {
        JSObject.global.Array.object!.new(value)
    }
}

private enum BackgroundError: Error {
    case webGPUNotAvailable
    case shaderLoadFailed
}

private let renderer = WebGPUBackground(canvasID: "swarm-field")
renderer?.start()
