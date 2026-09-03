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

  private logDresResponse(operation: string, response: unknown): void {
    console.info(`[DRES] ${operation} response`, response);
  }

  private logDresError(operation: string, error: unknown): void {
    console.error(`[DRES] ${operation} error`, error);
  }

  private normalizeMediaItemName(mediaItemName: string): string {
    return String(mediaItemName).replace(/\.[^./\\]+$/i, '');
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

      this.logDresResponse('login', user);

      return user;
    } catch (error) {
      this.logDresError('login', error);
      throw await this.mapApiError(error, 'Error during DRES login');
    }
  }

  async getEvaluationId(): Promise<string> {
    const session = this.requireSession();

    let runs: ApiClientEvaluationInfo[];
    try {
      runs = await this.evaluationClientApi.getApiV2ClientEvaluationList({ session });
      this.logDresResponse('getEvaluationList', runs);
    } catch (error) {
      this.logDresError('getEvaluationList', error);
      throw await this.mapApiError(error, 'Error while fetching evaluations');
    }

    const active = runs.find((run) => run.status === ApiEvaluationStatus.Active);
    if (!active?.id) {
      throw new DresClientError('No ACTIVE evaluation is available for the current session.', 404);
    }

    return active.id;
  }

  async listEvaluations(): Promise<ApiClientEvaluationInfo[]> {
    const session = this.requireSession();

    try {
      const response = await this.evaluationClientApi.getApiV2ClientEvaluationList({ session });
      this.logDresResponse('listEvaluations', response);
      return response;
    } catch (error) {
      this.logDresError('listEvaluations', error);
      throw await this.mapApiError(error, 'Error while fetching evaluations');
    }
  }

  async submitResultByTime(
    videoId: string,
    startMs: number,
    endMs: number = startMs,
    evaluationId: string
  ): Promise<SuccessfulSubmissionsStatus> {
    const session = this.requireSession();
    const normalizedMediaItemName = this.normalizeMediaItemName(videoId);
    const apiClientSubmission = {
      answerSets: [
        {
          answers: [
            {
              mediaItemName: normalizedMediaItemName,
              start: Math.floor(startMs),
              end: Math.floor(endMs)
            }
          ]
        }
      ]
    };

    console.info('[DRES] submitResultByTime payload', {
      evaluationId,
      session,
      apiClientSubmission
    });

    try {
      const response = await this.submissionApi.postApiV2SubmitByEvaluationId({
        evaluationId,
        session,
        apiClientSubmission
      });
      this.logDresResponse('submitResultByTime', response);
      return response;
    } catch (error) {
      this.logDresError('submitResultByTime', error);
      throw await this.mapSubmissionError(error);
    }
  }

  async submitResultByImgId(
    imageFilename: string,
    evaluationId: string
  ): Promise<SuccessfulSubmissionsStatus> {
    const session = this.requireSession();
    const normalizedMediaItemName = this.normalizeMediaItemName(imageFilename);
    const apiClientSubmission = {
      answerSets: [
        {
          answers: [
            {
              mediaItemName: normalizedMediaItemName
            }
          ]
        }
      ]
    };

    console.info('[DRES] submitResultByImgId payload', {
      evaluationId,
      session,
      apiClientSubmission
    });

    try {
      const response = await this.submissionApi.postApiV2SubmitByEvaluationId({
        evaluationId,
        session,
        apiClientSubmission
      });
      this.logDresResponse('submitResultByImgId', response);
      return response;
    } catch (error) {
      this.logDresError('submitResultByImgId', error);
      throw await this.mapSubmissionError(error);
    }
  }

  async submitTextAnswer(text: string, evaluationId: string): Promise<SuccessfulSubmissionsStatus> {
    const session = this.requireSession();
    const apiClientSubmission = {
      answerSets: [
        {
          answers: [
            {
              text
            }
          ]
        }
      ]
    };

    console.info('[DRES] submitTextAnswer payload', {
      evaluationId,
      session,
      apiClientSubmission
    });

    try {
      const response = await this.submissionApi.postApiV2SubmitByEvaluationId({
        evaluationId,
        session,
        apiClientSubmission
      });
      this.logDresResponse('submitTextAnswer', response);
      return response;
    } catch (error) {
      this.logDresError('submitTextAnswer', error);
      throw await this.mapSubmissionError(error);
    }
  }

  async submitResultLog(resultsLog: QueryResultLog, evaluationId: string): Promise<SuccessStatus> {
    const session = this.requireSession();

    try {
      const response = await this.logApi.postApiV2LogResultByEvaluationId({
        evaluationId,
        session,
        queryResultLog: resultsLog
      });
      this.logDresResponse('submitResultLog', response);
      return response;
    } catch (error) {
      this.logDresError('submitResultLog', error);
      throw await this.mapApiError(error, 'Error while sending result log');
    }
  }

  async logout(): Promise<SuccessStatus> {
    const session = this.requireSession();

    try {
      const response = await this.userApi.getApiV2Logout({ session });
      this.sessionId = null;
      this.logDresResponse('logout', response);
      return response;
    } catch (error) {
      this.logDresError('logout', error);
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
