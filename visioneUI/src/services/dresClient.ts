import {
  ApiEvaluationStatus,
  Configuration,
  EvaluationClientApi,
  LogApi,
  type QueryResultLog,
  type SuccessStatus,
  SubmissionApi,
  type SuccessfulSubmissionsStatus,
  type ApiClientEvaluationInfo,
  type ApiUser,
  UserApi,
  type LoginRequest,
  ResponseError
} from '$lib/dres-client';

export type DresClientOptions = {
  basePath: string;
  username: string;
  password: string;
  memberId?: string;
  persistSessionInfo?: boolean;
};

export type DresSessionInfo = {
  sessionId: string;
  username: string;
  memberId?: string;
  role?: string;
  createdAt: string;
};

function normalizeBasePath(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export class DresClientError extends Error {
  statusCode?: number;
  description?: string;

  constructor(message: string, statusCode?: number, description?: string) {
    super(message);
    this.name = 'DresClientError';
    this.statusCode = statusCode;
    this.description = description;
  }
}

export class DresClient {
  private readonly userApi: UserApi;
  private readonly evaluationClientApi: EvaluationClientApi;
  private readonly submissionApi: SubmissionApi;
  private readonly logApi: LogApi;
  private readonly options: DresClientOptions;

  private sessionId: string | null = null;

  constructor(options: DresClientOptions) {
    this.options = {
      ...options,
      basePath: normalizeBasePath(options.basePath)
    };

    const configuration = new Configuration({
      basePath: this.options.basePath
    });

    this.userApi = new UserApi(configuration);
    this.evaluationClientApi = new EvaluationClientApi(configuration);
    this.submissionApi = new SubmissionApi(configuration);
    this.logApi = new LogApi(configuration);
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  async login(): Promise<ApiUser> {
    const payload: LoginRequest = {
      username: this.options.username,
      password: this.options.password
    };

    try {
      const user = await this.userApi.postApiV2Login({ loginRequest: payload });
      if (!user?.sessionId) {
        throw new DresClientError('Login succeeded but sessionId is missing in the response.');
      }

      this.sessionId = user.sessionId;
      this.saveSessionInfo({
        sessionId: user.sessionId,
        username: user.username ?? this.options.username,
        memberId: this.options.memberId,
        role: user.role,
        createdAt: new Date().toISOString()
      });

      return user;
    } catch (error) {
      throw await this.mapApiError(error, 'Error during DRES login');
    }
  }

  async getEvaluationId(): Promise<string> {
    const session = this.requireSession();

    let runs: ApiClientEvaluationInfo[];
    try {
      runs = await this.evaluationClientApi.getApiV2ClientEvaluationList({ session });
    } catch (error) {
      throw await this.mapApiError(error, 'Error while fetching evaluations');
    }

    const active = runs.find((run) => run.status === ApiEvaluationStatus.Active);
    if (!active?.id) {
      throw new DresClientError('No ACTIVE evaluation is available for the current session.', 404);
    }

    return active.id;
  }

  async submitResultByTime(videoId: string, startMs: number, endMs: number = startMs): Promise<SuccessfulSubmissionsStatus> {
    const session = this.requireSession();
    const evaluationId = await this.getEvaluationId();

    try {
      return await this.submissionApi.postApiV2SubmitByEvaluationId({
        evaluationId,
        session,
        apiClientSubmission: {
          answerSets: [
            {
              answers: [
                {
                  mediaItemName: String(videoId),
                  start: Math.floor(startMs),
                  end: Math.floor(endMs)
                }
              ]
            }
          ]
        }
      });
    } catch (error) {
      throw await this.mapSubmissionError(error);
    }
  }

  async submitTextAnswer(text: string): Promise<SuccessfulSubmissionsStatus> {
    const session = this.requireSession();
    const evaluationId = await this.getEvaluationId();

    try {
      return await this.submissionApi.postApiV2SubmitByEvaluationId({
        evaluationId,
        session,
        apiClientSubmission: {
          answerSets: [
            {
              answers: [
                {
                  text
                }
              ]
            }
          ]
        }
      });
    } catch (error) {
      throw await this.mapSubmissionError(error);
    }
  }

  async submitResultLog(resultsLog: QueryResultLog): Promise<SuccessStatus> {
    const session = this.requireSession();
    const evaluationId = await this.getEvaluationId();

    try {
      return await this.logApi.postApiV2LogResultByEvaluationId({
        evaluationId,
        session,
        queryResultLog: resultsLog
      });
    } catch (error) {
      throw await this.mapApiError(error, 'Error while sending result log');
    }
  }

  async logout(): Promise<SuccessStatus> {
    const session = this.requireSession();

    try {
      const response = await this.userApi.getApiV2Logout({ session });
      this.sessionId = null;
      return response;
    } catch (error) {
      throw await this.mapApiError(error, 'Error during DRES logout');
    }
  }

  private requireSession(): string {
    if (!this.sessionId) {
      throw new DresClientError('DRES session is missing. Run login() first.', 401);
    }
    return this.sessionId;
  }

  private saveSessionInfo(info: DresSessionInfo): void {
    if (!this.options.persistSessionInfo) return;
    if (typeof window === 'undefined') return;

    const key = `dres:session:${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(info));
  }

  private async mapSubmissionError(error: unknown): Promise<DresClientError> {
    if (error instanceof ResponseError) {
      const statusCode = error.response.status;
      const description = await this.extractErrorDescription(error.response);

      if (statusCode === 401) {
        return new DresClientError(
          `DRES 401: authentication failed during submission. ${description ?? ''}`.trim(),
          statusCode,
          description
        );
      }

      if (statusCode === 404) {
        return new DresClientError(
          `DRES 404: no active task accepts submissions. ${description ?? ''}`.trim(),
          statusCode,
          description
        );
      }

      if (statusCode === 412) {
        return new DresClientError(
          `DRES 412: submission rejected by server. ${description ?? ''}`.trim(),
          statusCode,
          description
        );
      }

      return new DresClientError(
        `DRES ${statusCode}: error during submission. ${description ?? ''}`.trim(),
        statusCode,
        description
      );
    }

    if (error instanceof Error) {
      return new DresClientError(error.message);
    }

    return new DresClientError('Unknown error during submission');
  }

  private async mapApiError(error: unknown, contextMessage: string): Promise<DresClientError> {
    if (error instanceof ResponseError) {
      const statusCode = error.response.status;
      const description = await this.extractErrorDescription(error.response);
      return new DresClientError(
        `${contextMessage} (HTTP ${statusCode})${description ? `: ${description}` : ''}`,
        statusCode,
        description
      );
    }

    if (error instanceof Error) {
      return new DresClientError(`${contextMessage}: ${error.message}`);
    }

    return new DresClientError(contextMessage);
  }

  private async extractErrorDescription(response: Response): Promise<string | undefined> {
    try {
      const body = await response.clone().json();
      if (typeof body?.description === 'string') return body.description;
      if (typeof body?.message === 'string') return body.message;
      return undefined;
    } catch {
      try {
        const text = await response.clone().text();
        return text || undefined;
      } catch {
        return undefined;
      }
    }
  }
}

export function createDresClientFromEnv(): DresClient {
  const basePath = normalizeBasePath(import.meta.env.VITE_DRES_BASE_URL ?? '');
  const username = import.meta.env.VITE_DRES_USERNAME;
  const password = import.meta.env.VITE_DRES_PASSWORD;
  const memberId = import.meta.env.VITE_DRES_MEMBER_ID;

  if (!basePath || !username || !password) {
    throw new DresClientError(
      'Missing DRES config. Set VITE_DRES_BASE_URL, VITE_DRES_USERNAME, VITE_DRES_PASSWORD.'
    );
  }

  return new DresClient({
    basePath,
    username,
    password,
    memberId,
    persistSessionInfo: true
  });
}

export function createDresClientFromSettings(settings: {
  dresSubmitServer?: string;
  dresUsername?: string;
  dresPassword?: string;
  dresMemberId?: string;
  dresEnabled?: boolean;
}): DresClient {
  const basePath = normalizeBasePath(settings?.dresSubmitServer ?? '');
  const username = settings?.dresUsername?.trim();
  const password = settings?.dresPassword ?? '';
  const memberId = settings?.dresMemberId?.trim();

  if (!settings?.dresEnabled) {
    throw new DresClientError('DRES is disabled in settings.');
  }

  if (!basePath || !username || !password) {
    throw new DresClientError(
      'Incomplete DRES config. Set submit server, username, and password in settings.'
    );
  }

  return new DresClient({
    basePath,
    username,
    password,
    memberId,
    persistSessionInfo: true
  });
}
