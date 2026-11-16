import {useEffect, useRef, useState} from "react";
import {TestCase} from "../../types/TestCase.ts";
import {Autocomplete, Box, Button, Chip, TextField, Typography} from "@mui/material";
import {BugReport, Delete, Save} from "@mui/icons-material";
import {useSnippetRun} from "../../utils/queries.tsx";
import {RunConnection} from "../../utils/http/snippetRunSocket.ts";
import {queryClient} from "../../App.tsx";
import {TestRunResult} from "../../types/TestCase.ts";

type TabPanelProps = {
    index: number;
    value: number;
    snippetId: string;
    test?: TestCase;
    setTestCase: (test: Partial<TestCase>) => void;
    removeTestCase?: (testIndex: string) => void;
}

const STATUS_CHIP: Record<TestRunResult["status"], { label: string, color: "success" | "error" | "warning" | "default" }> = {
    PASSED: {label: "Pass", color: "success"},
    FAILED: {label: "Fail", color: "error"},
    ERROR: {label: "Error", color: "warning"},
    PENDING: {label: "Not run", color: "default"},
}

export const TabPanel = ({value, index, snippetId, test: initialTest, setTestCase, removeTestCase}: TabPanelProps) => {
    const [testData, setTestData] = useState<Partial<TestCase> | undefined>(initialTest);

    const openRun = useSnippetRun();
    const [result, setResult] = useState<TestRunResult | undefined>();
    const [liveOutput, setLiveOutput] = useState<string[]>([]);
    const [running, setRunning] = useState(false);
    const connection = useRef<RunConnection | null>(null);

    useEffect(() => () => connection.current?.close(), []);

    // US 9: one test at a time, seeing each printed line while it runs.
    const testSnippet = (test: Partial<TestCase>) => {
        setRunning(true);
        setResult(undefined);
        setLiveOutput([]);
        const start = test.id
            ? {type: "test" as const, testId: test.id}
            : {type: "test" as const, inputs: test.input ?? [], expectedOutputs: test.output ?? []};
        const ended = (outcome: TestRunResult) => {
            setResult(outcome);
            setRunning(false);
            connection.current = null;
            if (test.id) queryClient.invalidateQueries(['testCases', snippetId]);
        };
        openRun(snippetId, start, {
            onOutput: line => setLiveOutput(previous => [...previous, line]),
            onResult: ended,
            onError: message => ended({
                status: "ERROR", outputs: [], expectedOutputs: test.output ?? [], errors: [message],
            }),
        }).then(opened => connection.current = opened)
          .catch(() => ended({
              status: "ERROR", outputs: [], expectedOutputs: test.output ?? [], errors: ["Could not start the test"],
          }));
    };


    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`vertical-tabpanel-${index}`}
            aria-labelledby={`vertical-tab-${index}`}
            style={{width: '100%', height: '100%'}}
        >
            {value === index && (
                <Box sx={{px: 3}} display="flex" flexDirection="column" gap={2}>
                    <Box display="flex" flexDirection="column" gap={1}>
                        <Typography fontWeight="bold">Name</Typography>
                        <TextField size="small" value={testData?.name ?? ""}
                                   onChange={(e) => setTestData({...testData, name: e.target.value})}/>
                    </Box>
                    <Box display="flex" flexDirection="column" gap={1}>
                        <Typography fontWeight="bold">Input</Typography>
                        <Autocomplete
                            multiple
                            size="small"
                            freeSolo
                            value={testData?.input ?? []}
                            onChange={(_, value) => setTestData({...testData, input: value})}
                            renderTags={(value: readonly string[], getTagProps) =>
                                value.map((option: string, index: number) => (
                                    <Chip variant="outlined" label={option} {...getTagProps({index})} />
                                ))
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                />
                            )}
                            options={[]}
                        />
                    </Box>
                    <Box display="flex" flexDirection="column" gap={1}>
                        <Typography fontWeight="bold">Expected output</Typography>
                        <Autocomplete
                            multiple
                            size="small"
                            freeSolo
                            value={testData?.output ?? []}
                            onChange={(_, value) => setTestData({...testData, output: value})}
                            renderTags={(value: readonly string[], getTagProps) =>
                                value.map((option: string, index: number) => (
                                    <Chip variant="outlined" label={option} {...getTagProps({index})} />
                                ))
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                />
                            )}
                            options={[]}
                        />
                    </Box>
                    <Box display="flex" flexDirection="row" gap={1} alignItems="center">
                        {
                            (testData?.id && removeTestCase) && (
                            <Button onClick={() => removeTestCase(testData?.id ?? "")} variant={"outlined"} color={"error"}
                                    startIcon={<Delete/>}>
                                Remove
                            </Button>)
                        }
                        <Button disabled={!testData?.name} onClick={() => setTestCase(testData ?? {})} variant={"outlined"} startIcon={<Save/>}>
                            Save
                        </Button>
                        <Button onClick={() => testSnippet(testData ?? {})} variant={"contained"} startIcon={<BugReport/>}
                                disabled={running} disableElevation>
                            Test
                        </Button>
                        {result && (
                            <Chip label={STATUS_CHIP[result.status].label} color={STATUS_CHIP[result.status].color}/>
                        )}
                    </Box>
                    {running && (
                        <Box display="flex" flexDirection="column" gap={0.5}>
                            <Typography fontWeight="bold">Running...</Typography>
                            {liveOutput.map((line, index) => (
                                <Typography key={index} fontFamily="monospace">{line}</Typography>
                            ))}
                        </Box>
                    )}
                    {result && (result.status === "FAILED" || result.status === "ERROR") && (
                        <Box display="flex" flexDirection="column" gap={0.5}>
                            <Typography fontWeight="bold">Expected: {result.expectedOutputs.join(", ") || "(nothing)"}</Typography>
                            <Typography>Got: {result.outputs.join(", ") || "(nothing)"}</Typography>
                            {result.errors.map((error) => (
                                <Typography key={error} color="error">{error}</Typography>
                            ))}
                        </Box>
                    )}
                </Box>
            )}
        </div>
    );
}
