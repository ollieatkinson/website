extension Interpreter {
    func registerBuiltins() {
        registerMathBuiltins()
        registerIOBuiltins()
    }

    func registerBuiltin(name: String, body: @escaping ([Value]) async throws -> Value) {
        let fn = Function(name: name, parameters: [], kind: .builtin(body))
        rootScope.bind(name, value: .function(fn), mutable: false)
    }
}
