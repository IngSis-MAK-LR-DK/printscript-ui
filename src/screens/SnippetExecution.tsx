import {OutlinedInput} from "@mui/material";
import {highlight, languages} from "prismjs";
import Editor from "react-simple-code-editor";
import {Bòx} from "../components/snippet-table/SnippetBox.tsx";
import {useEffect, useRef, useState} from "react";
import {useSnippetRun} from "../utils/queries.tsx";
import {RunConnection} from "../utils/http/snippetRunSocket.ts";

type SnippetExecutionProps = {
  snippetId: string
  /** The Run button was pressed; turning it off stops the run. */
  running: boolean
  onFinished: () => void
}

/** US 10: runs the saved snippet, showing each line as it is printed and asking for inputs. */
export const SnippetExecution = ({snippetId, running, onFinished}: SnippetExecutionProps) => {
  const [input, setInput] = useState<string>("")
  const [output, setOutput] = useState<string[]>([]);
  const [waitingInput, setWaitingInput] = useState(false)
  const connection = useRef<RunConnection | null>(null)
  const openRun = useSnippetRun()

  useEffect(() => {
    if (!running) {
      return
    }
    let cancelled = false
    setOutput([])
    setWaitingInput(false)
    const finish = (lines: string[]) => {
      setOutput(previous => [...previous, ...lines])
      setWaitingInput(false)
      onFinished()
    }
    openRun(snippetId, {type: "run"}, {
      onOutput: line => setOutput(previous => [...previous, line]),
      onInputRequested: prompt => {
        if (prompt) setOutput(previous => [...previous, prompt])
        setWaitingInput(true)
      },
      onDone: errors => finish(errors.map(error => `Error: ${error}`)),
      onError: message => finish([`Error: ${message}`]),
    }).then(opened => {
      if (cancelled) opened.close()
      else connection.current = opened
    }).catch(() => finish(["Error: could not start the run"]))

    return () => {
      cancelled = true
      connection.current?.close()
      connection.current = null
    }
    // A new run only when Run is pressed again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, snippetId])

  const code = output.join("\n")

  const handleEnter = (event: { key: string }) => {
    if (event.key === 'Enter' && waitingInput) {
      connection.current?.sendInput(input)
      setOutput([...output, input])
      setWaitingInput(false)
      setInput("")
    }
  };

    return (
      <>
        <Bòx flex={1} overflow={"none"} minHeight={200} bgcolor={'black'} color={'white'} code={code}>
            <Editor
              value={code}
              padding={10}
              onValueChange={() => {}}
              readOnly
              highlight={(code) => highlight(code, languages.js, 'javascript')}
              maxLength={1000}
              style={{
                  fontFamily: "monospace",
                  fontSize: 17,
              }}
            />
        </Bòx>
        <OutlinedInput onKeyDown={handleEnter} value={input} onChange={e => setInput(e.target.value)}
                       disabled={!waitingInput}
                       placeholder={waitingInput ? "Type the input and press Enter" : "Type here"} fullWidth/>
      </>
    )
}
