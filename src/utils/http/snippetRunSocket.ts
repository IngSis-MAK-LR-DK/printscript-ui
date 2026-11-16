import {TestRunResult, TestStatus} from "../../types/TestCase.ts";

/**
 * Streamed runs of a snippet (US 9 and 10) with the browser's own WebSocket: the output arrives
 * line by line and the inputs are asked for while the snippet runs.
 * Protocol: snippet-handler/docs/streaming-execution.md
 */

/** What starts a run: interactive, a saved test, or a test that is not saved yet. */
export type RunStart =
  | { type: "run" }
  | { type: "test", testId: string }
  | { type: "test", inputs: string[], expectedOutputs: string[] }

export type RunHandlers = {
  onOutput: (line: string) => void
  onInputRequested?: (prompt: string) => void
  /** Interactive run ended; errors is empty if it went well. */
  onDone?: (errors: string[]) => void
  onResult?: (result: TestRunResult) => void
  /** The run could not happen or the connection was lost before the end. */
  onError: (message: string) => void
}

export type RunConnection = {
  sendInput: (value: string) => void
  close: () => void
}

type ServerMessage =
  | { type: "output", line: string }
  | { type: "input", prompt: string }
  | { type: "done", errors: string[] }
  | { type: "result", testId: string | null, status: TestStatus, outputs: string[], expectedOutputs: string[], errors: string[] }
  | { type: "error", message: string }

/** ws(s)://.../snippets/{id}/run from the backend URL (absolute or relative, like /api). */
const runUrl = (backendUrl: string, snippetId: string): string => {
  const url = new URL(`${backendUrl.replace(/\/+$/, "")}/snippets/${snippetId}/run`, window.location.href)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.toString()
}

export const openSnippetRun = async (
    backendUrl: string,
    getToken: () => Promise<string>,
    snippetId: string,
    start: RunStart,
    handlers: RunHandlers,
): Promise<RunConnection> => {
  const token = await getToken()
  // A browser cannot set headers on a WebSocket: the token goes as subprotocol.
  const socket = new WebSocket(runUrl(backendUrl, snippetId), ["bearer", token])
  let finished = false

  socket.onopen = () => socket.send(JSON.stringify(start))
  socket.onmessage = (event: MessageEvent<string>) => {
    const message = JSON.parse(event.data) as ServerMessage
    switch (message.type) {
      case "output":
        handlers.onOutput(message.line)
        break
      case "input":
        handlers.onInputRequested?.(message.prompt)
        break
      case "done":
        finished = true
        handlers.onDone?.(message.errors)
        break
      case "result":
        finished = true
        handlers.onResult?.({
          testId: message.testId ?? undefined,
          status: message.status,
          outputs: message.outputs,
          expectedOutputs: message.expectedOutputs,
          errors: message.errors,
        })
        break
      case "error":
        finished = true
        handlers.onError(message.message)
        break
    }
  }
  socket.onclose = () => {
    if (!finished) {
      handlers.onError("The connection was closed before the run ended")
    }
  }

  return {
    sendInput: (value: string) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({type: "input", value}))
      }
    },
    close: () => {
      finished = true
      socket.close()
    },
  }
}
