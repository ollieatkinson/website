import JavaScriptKit

struct BackgroundScene {
    private let device: JSObject
    private let context: JSObject
    private let pipeline: JSObject
    private let uniformBuffer: JSObject
    private let uniformArray: JSTypedArray<Float32>
    private let bindGroup: JSObject

    static func make(
        canvas: JSObject,
        runtime: BrowserRuntime,
        shaderSource: String,
        device: JSObject
    ) throws -> BackgroundScene {
        let gpu = runtime.navigator.gpu.object!
        guard let context = canvas.getContext!("webgpu").object else {
            throw BackgroundError.webGPUNotAvailable
        }

        let format = gpu.getPreferredCanvasFormat!()
        configureCanvas(context: context, device: device, format: format)

        let pipeline = makePipeline(device: device, shaderSource: shaderSource, format: format)
        guard let pipelineObject = pipeline.object else {
            throw BackgroundError.webGPUNotAvailable
        }

        let uniformBuffer = makeUniformBuffer(device: device)
        let bindGroup = makeBindGroup(
            device: device,
            pipeline: pipeline,
            uniformBuffer: uniformBuffer
        )

        guard
            let uniformBufferObject = uniformBuffer.object,
            let bindGroupObject = bindGroup.object
        else {
            throw BackgroundError.webGPUNotAvailable
        }

        return BackgroundScene(
            device: device,
            context: context,
            pipeline: pipelineObject,
            uniformBuffer: uniformBufferObject,
            uniformArray: JSTypedArray<Float32>(length: UniformLayout.componentCount),
            bindGroup: bindGroupObject
        )
    }

    func draw(time: Double, viewport: Viewport, pointer: PointerState) {
        Uniforms(time: time, viewport: viewport, pointer: pointer)
            .write(to: uniformArray)

        _ = device.queue.writeBuffer(uniformBuffer, 0, uniformArray)

        let texture = context.getCurrentTexture!().object!
        let textureView = texture.createView!()
        let colorAttachment = JSFactory.object()
        colorAttachment.view = textureView
        colorAttachment.loadOp = .string("clear")
        colorAttachment.storeOp = .string("store")
        colorAttachment.clearValue = .object(ClearColor.background.jsObject)

        let renderPassDescriptor = JSFactory.object()
        renderPassDescriptor.colorAttachments = .object(JSFactory.array(colorAttachment))

        let commandEncoder = device.createCommandEncoder!().object!
        let passEncoder = commandEncoder.beginRenderPass!(renderPassDescriptor).object!
        _ = passEncoder.setPipeline!(pipeline)
        _ = passEncoder.setBindGroup!(0, bindGroup)
        _ = passEncoder.draw!(3)
        _ = passEncoder.end!()
        _ = device.queue.submit(JSFactory.array(commandEncoder.finish!().object!))
    }

    private static func configureCanvas(context: JSObject, device: JSObject, format: JSValue) {
        let configuration = JSFactory.object()
        configuration.device = .object(device)
        configuration.format = format
        configuration.alphaMode = .string("premultiplied")
        _ = context.configure!(configuration)
    }

    private static func makePipeline(device: JSObject, shaderSource: String, format: JSValue) -> JSValue {
        let shaderDescriptor = JSFactory.object()
        shaderDescriptor.label = .string("olbo background shader")
        shaderDescriptor.code = .string(shaderSource)
        let shaderModule = device.createShaderModule!(shaderDescriptor)

        let fragmentStage = makeStage(module: shaderModule, entryPoint: "fragmentMain")
        let target = JSFactory.object()
        target.format = format
        fragmentStage.targets = .object(JSFactory.array(target))

        let pipelineDescriptor = JSFactory.object()
        pipelineDescriptor.label = .string("olbo background pipeline")
        pipelineDescriptor.layout = .string("auto")
        pipelineDescriptor.vertex = .object(makeStage(module: shaderModule, entryPoint: "vertexMain"))
        pipelineDescriptor.fragment = .object(fragmentStage)

        return device.createRenderPipeline!(pipelineDescriptor)
    }

    private static func makeStage(module: JSValue, entryPoint: String) -> JSObject {
        let stage = JSFactory.object()
        stage.module = module
        stage.entryPoint = .string(entryPoint)
        return stage
    }

    private static func makeUniformBuffer(device: JSObject) -> JSValue {
        let descriptor = JSFactory.object()
        descriptor.label = .string("olbo uniforms")
        descriptor.size = .number(Double(UniformLayout.byteCount))
        descriptor.usage = .number(Double(GPUBufferUsage.uniform | GPUBufferUsage.copyDestination))
        return device.createBuffer!(descriptor)
    }

    private static func makeBindGroup(
        device: JSObject,
        pipeline: JSValue,
        uniformBuffer: JSValue
    ) -> JSValue {
        let bindingResource = JSFactory.object()
        bindingResource.buffer = uniformBuffer

        let entry = JSFactory.object()
        entry.binding = .number(0)
        entry.resource = .object(bindingResource)

        let descriptor = JSFactory.object()
        descriptor.layout = pipeline.object!.getBindGroupLayout!(0)
        descriptor.entries = .object(JSFactory.array(entry))
        return device.createBindGroup!(descriptor)
    }
}

private enum UniformLayout {
    static let componentCount = 8
    static let byteCount = componentCount * MemoryLayout<Float32>.size
}

private enum GPUBufferUsage {
    static let uniform = 0x0040
    static let copyDestination = 0x0008
}

private struct Uniforms {
    var time: Double
    var viewport: Viewport
    var pointer: PointerState

    func write(to storage: JSTypedArray<Float32>) {
        storage[0] = Float32(time)
        storage[1] = Float32(viewport.pixelWidth)
        storage[2] = Float32(viewport.pixelHeight)
        storage[3] = Float32(pointer.position.x)
        storage[4] = Float32(pointer.position.y)
        storage[5] = Float32(pointer.energy)
        storage[6] = 0
        storage[7] = 0
    }
}

private struct ClearColor {
    var red: Double
    var green: Double
    var blue: Double
    var alpha: Double

    static let background = ClearColor(red: 0.02, green: 0.027, blue: 0.04, alpha: 1)

    var jsObject: JSObject {
        let color = JSFactory.object()
        color.r = .number(red)
        color.g = .number(green)
        color.b = .number(blue)
        color.a = .number(alpha)
        return color
    }
}

private enum JSFactory {
    static func object() -> JSObject {
        JSObject.global.Object.object!.new()
    }

    static func array(_ value: JSObject) -> JSObject {
        JSObject.global.Array.object!.new(value)
    }
}
