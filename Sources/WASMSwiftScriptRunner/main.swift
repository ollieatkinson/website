import JavaScriptEventLoop
import JavaScriptKit
import SwiftScriptWasmInterpreter

JavaScriptEventLoop.installGlobalExecutor()

private final class OutputBuffer: @unchecked Sendable {
    private var lines: [String] = []

    func append(_ line: String) {
        lines.append(line)
    }

    var text: String {
        lines.joined(separator: "\n")
    }
}

private final class SwiftScriptRunner: @unchecked Sendable {
    private let global = JSObject.global
    private var evaluateClosure: JSClosure?

    func install() {
        evaluateClosure = JSClosure { [weak self] arguments in
            guard let self else {
                return .undefined
            }

            let source = arguments.first?.string ?? ""
            let callback = arguments.dropFirst().first?.object

            Task {
                let response = await self.evaluate(source)
                _ = callback?.callAsFunction(response)
            }

            return .undefined
        }

        if let evaluateClosure {
            global.swiftScriptEvaluate = .object(evaluateClosure)
            global.swiftScriptReady = .boolean(true)
        }
    }

    private func evaluate(_ source: String) async -> JSObject {
        let startedAt = global.performance.now().number ?? 0
        let output = OutputBuffer()
        let interpreter = Interpreter { line in
            output.append(line)
        }

        do {
            let result = try await interpreter.eval(source, fileName: "Playground.swift")
            return makeResponse(
                ok: true,
                output: output.text,
                result: result.description,
                diagnostics: "",
                elapsedMilliseconds: elapsedMilliseconds(since: startedAt)
            )
        } catch let parseError as ParseError {
            return makeResponse(
                ok: false,
                output: output.text,
                result: "",
                diagnostics: parseError.formatted,
                elapsedMilliseconds: elapsedMilliseconds(since: startedAt)
            )
        } catch {
            return makeResponse(
                ok: false,
                output: output.text,
                result: "",
                diagnostics: interpreter.renderRuntimeError(error),
                elapsedMilliseconds: elapsedMilliseconds(since: startedAt)
            )
        }
    }

    private func elapsedMilliseconds(since startedAt: Double) -> Double {
        (global.performance.now().number ?? startedAt) - startedAt
    }

    private func makeResponse(
        ok: Bool,
        output: String,
        result: String,
        diagnostics: String,
        elapsedMilliseconds: Double
    ) -> JSObject {
        let response = makeObject()
        response.ok = .boolean(ok)
        response.output = .string(output)
        response.result = .string(result)
        response.diagnostics = .string(diagnostics)
        response.elapsedMilliseconds = .number(elapsedMilliseconds)
        return response
    }

    private func makeObject() -> JSObject {
        global.Object.object!.new()
    }
}

private let runner = SwiftScriptRunner()
runner.install()
