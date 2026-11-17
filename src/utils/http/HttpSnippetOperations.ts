import {CreateSnippet, ComplianceEnum, LintViolation, PaginatedSnippets, Snippet, UpdateSnippet} from "../snippet.ts";
import {DownloadedSnippet, SnippetOperations} from "../snippetOperations.ts";
import {PaginatedUsers, User} from "../users.ts";
import {TestCase, TestStatus} from "../../types/TestCase.ts";
import {FileType} from "../../types/FileType.ts";
import {Rule} from "../../types/Rule.ts";

/** Language the rules screen works with. The backend supports more, the UI only shows PrintScript. */
const RULES_LANGUAGE = "printscript";

/** Shapes returned by snippet-handler (see snippet-handler/README.md). */
type SnippetDto = {
  id: string
  name: string
  description?: string | null
  language: string
  version: string
  ownerId: string
  compliance: "PENDING" | "COMPLIANT" | "NOT_COMPLIANT" | "FAILED"
  lintViolations?: LintViolation[]
  content?: string
}

// Formato de Spring Data (VIA_DTO): los datos de la pagina vienen en "page".
type PageDto<T> = {
  content: T[]
  page: { size: number, number: number, totalElements: number }
}

type RuleViewDto = { name: string, description: string, enabled: boolean, value: string | null }

type TestCaseViewDto = {
  id: string
  name: string
  inputs: string[]
  expectedOutputs: string[]
  lastStatus: TestStatus
}

type LanguageInfoDto = { name: string, versions: string[], fileExtension: string }

const COMPLIANCE: Record<SnippetDto["compliance"], ComplianceEnum> = {
  PENDING: "pending",
  COMPLIANT: "compliant",
  NOT_COMPLIANT: "not-compliant",
  FAILED: "failed",
}

/** Compliance as the backend's enum, for filtering the listing. */
const COMPLIANCE_FILTER: Record<ComplianceEnum, SnippetDto["compliance"]> = {
  pending: "PENDING",
  compliant: "COMPLIANT",
  "not-compliant": "NOT_COMPLIANT",
  failed: "FAILED",
}

const toSnippet = (dto: SnippetDto, content = ""): Snippet => ({
  id: dto.id,
  name: dto.name,
  description: dto.description ?? undefined,
  language: dto.language,
  version: dto.version,
  content: dto.content ?? content,
  compliance: COMPLIANCE[dto.compliance],
  author: dto.ownerId,
  lintViolations: dto.lintViolations,
})

const toRule = (dto: RuleViewDto): Rule => ({
  id: dto.name,
  name: dto.name,
  isActive: dto.enabled,
  value: dto.value,
})

const toTestCase = (dto: TestCaseViewDto): TestCase => ({
  id: dto.id,
  name: dto.name,
  input: dto.inputs,
  output: dto.expectedOutputs,
  lastStatus: dto.lastStatus,
})

/** Filename from a Content-Disposition header, e.g. attachment; filename*=UTF-8''name.ps */
const filenameOf = (header: string | undefined, fallback: string): string => {
  if (!header) return fallback
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (encoded) return decodeURIComponent(encoded[1])
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain ? plain[1] : fallback
}

/** Error carrying the HTTP status, so callers can tell a 404 apart from other failures. */
export class HttpError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
  }
}

type Params = Record<string, string | number | boolean>

type RequestOptions = { params?: Params, body?: unknown }

/**
 * Talks to snippet-handler with the browser's fetch. Every request carries the Auth0 access token
 * obtained through the given function, so the backend can authenticate the user.
 */
export class HttpSnippetOperations implements SnippetOperations {

  constructor(private readonly baseURL: string, private readonly getAccessToken: () => Promise<string>) {}

  /** Sends the request and fails with an HttpError (the backend's "detail" if any) unless it is 2xx. */
  private async send(method: string, path: string, {params, body}: RequestOptions = {}): Promise<Response> {
    const query = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}` : ""
    const headers: Record<string, string> = {Authorization: `Bearer ${await this.getAccessToken()}`}
    if (body !== undefined) headers["Content-Type"] = "application/json"
    let response: Response
    try {
      response = await fetch(`${this.baseURL}${path}${query}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      throw new HttpError(error instanceof Error ? error.message : String(error))
    }
    if (!response.ok) {
      const detail = await response.json().then((json: { detail?: string }) => json.detail).catch(() => undefined)
      throw new HttpError(detail ?? `Request failed with status code ${response.status}`, response.status)
    }
    return response
  }

  /** The JSON body of the response; undefined when there is none (204). */
  private async call<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
    const response = await this.send(method, path, options)
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  async listSnippetDescriptors(page: number, pageSize: number, snippetName?: string, compliance?: ComplianceEnum): Promise<PaginatedSnippets> {
    const pageDto = await this.call<PageDto<SnippetDto>>("GET", "/snippets", {
      params: {
        relation: "ALL",
        page,
        size: pageSize,
        sort: "name,asc",
        ...(snippetName ? {name: snippetName} : {}),
        ...(compliance ? {compliance: COMPLIANCE_FILTER[compliance]} : {}),
      },
    })
    return {
      page: pageDto.page.number,
      page_size: pageDto.page.size,
      count: pageDto.page.totalElements,
      snippets: pageDto.content.map((dto) => toSnippet(dto)),
    }
  }

  async createSnippet(createSnippet: CreateSnippet): Promise<Snippet> {
    if (!createSnippet.version) {
      throw new Error("Choose a language version before saving")
    }
    const dto = await this.call<SnippetDto>("POST", "/snippets", {
      body: {
        name: createSnippet.name,
        description: createSnippet.description ?? null,
        language: createSnippet.language,
        version: createSnippet.version,
        content: createSnippet.content,
      },
    })
    return toSnippet(dto, createSnippet.content)
  }

  async getSnippetById(id: string): Promise<Snippet | undefined> {
    try {
      return toSnippet(await this.call<SnippetDto>("GET", `/snippets/${id}`))
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return undefined
      throw error
    }
  }

  async updateSnippetById(id: string, updateSnippet: UpdateSnippet): Promise<Snippet> {
    const dto = await this.call<SnippetDto>("PUT", `/snippets/${id}`, {body: {content: updateSnippet.content}})
    return toSnippet(dto, updateSnippet.content)
  }

  async getUserFriends(name: string = "", page: number = 0, pageSize: number = 10): Promise<PaginatedUsers> {
    const users = await this.call<{id: string, name: string}[]>("GET", "/users", {
      params: {query: name, page, size: pageSize},
    })
    const mapped: User[] = users.map((u) => ({id: u.id, name: u.name}))
    return {page, page_size: pageSize, count: mapped.length, users: mapped}
  }

  async shareSnippet(snippetId: string, userId: string): Promise<Snippet> {
    await this.call("POST", `/snippets/${snippetId}/share`, {body: {userId}})
    const snippet = await this.getSnippetById(snippetId)
    if (!snippet) throw new Error("Snippet not found after sharing")
    return snippet
  }

  async getFormatRules(): Promise<Rule[]> {
    const rules = await this.call<RuleViewDto[]>("GET", "/rules/format", {params: {language: RULES_LANGUAGE}})
    return rules.map(toRule)
  }

  async getLintingRules(): Promise<Rule[]> {
    const rules = await this.call<RuleViewDto[]>("GET", "/rules/lint", {params: {language: RULES_LANGUAGE}})
    return rules.map(toRule)
  }

  modifyFormatRule(newRules: Rule[]): Promise<Rule[]> {
    return this.saveRules("/rules/format", newRules)
  }

  modifyLintingRule(newRules: Rule[]): Promise<Rule[]> {
    return this.saveRules("/rules/lint", newRules)
  }

  private async saveRules(path: string, rules: Rule[]): Promise<Rule[]> {
    const saved = await this.call<RuleViewDto[]>("PUT", path, {
      params: {language: RULES_LANGUAGE},
      body: rules.map((rule) => ({
        name: rule.name,
        enabled: rule.isActive,
        value: rule.value == null ? null : String(rule.value),
      })),
    })
    return saved.map(toRule)
  }

  async formatSnippet(snippetContent: string, language: string, version: string): Promise<string> {
    const result = await this.call<{content: string}>("POST", "/snippets/format", {
      body: {language, version, content: snippetContent},
    })
    return result.content
  }

  async getTestCases(snippetId: string): Promise<TestCase[]> {
    const tests = await this.call<TestCaseViewDto[]>("GET", `/snippets/${snippetId}/tests`)
    return tests.map(toTestCase)
  }

  async postTestCase(snippetId: string, testCase: Partial<TestCase>): Promise<TestCase> {
    const body = {
      name: testCase.name ?? "",
      inputs: testCase.input ?? [],
      expectedOutputs: testCase.output ?? [],
    }
    const dto = testCase.id
      ? await this.call<TestCaseViewDto>("PUT", `/snippets/${snippetId}/tests/${testCase.id}`, {body})
      : await this.call<TestCaseViewDto>("POST", `/snippets/${snippetId}/tests`, {body})
    return toTestCase(dto)
  }

  async removeTestCase(snippetId: string, testId: string): Promise<string> {
    await this.call("DELETE", `/snippets/${snippetId}/tests/${testId}`)
    return testId
  }

  async deleteSnippet(id: string): Promise<string> {
    await this.call("DELETE", `/snippets/${id}`)
    return id
  }

  async downloadSnippet(id: string, formatted: boolean): Promise<DownloadedSnippet> {
    const response = await this.send("GET", `/snippets/${id}/download`, {params: {formatted}})
    return {
      blob: await response.blob(),
      filename: filenameOf(response.headers.get("content-disposition") ?? undefined, `${id}.txt`),
    }
  }

  async getFileTypes(): Promise<FileType[]> {
    const languages = await this.call<LanguageInfoDto[]>("GET", "/languages")
    return languages.map((l) => ({language: l.name, extension: l.fileExtension, versions: l.versions}))
  }
}
