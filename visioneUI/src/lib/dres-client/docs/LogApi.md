# LogApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**postApiV2LogQueryByEvaluationId**](LogApi.md#postapiv2logquerybyevaluationid) | **POST** /api/v2/log/query/{evaluationId} | Accepts query logs from participants for the specified evaluation. |
| [**postApiV2LogResultByEvaluationId**](LogApi.md#postapiv2logresultbyevaluationid) | **POST** /api/v2/log/result/{evaluationId} | Accepts result logs from participants  for the specified evaluation. |



## postApiV2LogQueryByEvaluationId

> SuccessStatus postApiV2LogQueryByEvaluationId(evaluationId, session, queryEventLog)

Accepts query logs from participants for the specified evaluation.

### Example

```ts
import {
  Configuration,
  LogApi,
} from '';
import type { PostApiV2LogQueryByEvaluationIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LogApi();

  const body = {
    // string | The evaluation ID.
    evaluationId: evaluationId_example,
    // string | Session Token
    session: session_example,
    // QueryEventLog (optional)
    queryEventLog: ...,
  } satisfies PostApiV2LogQueryByEvaluationIdRequest;

  try {
    const data = await api.postApiV2LogQueryByEvaluationId(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **evaluationId** | `string` | The evaluation ID. | [Defaults to `undefined`] |
| **session** | `string` | Session Token | [Defaults to `undefined`] |
| **queryEventLog** | [QueryEventLog](QueryEventLog.md) |  | [Optional] |

### Return type

[**SuccessStatus**](SuccessStatus.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |
| **401** | Unauthorized |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## postApiV2LogResultByEvaluationId

> SuccessStatus postApiV2LogResultByEvaluationId(evaluationId, session, queryResultLog)

Accepts result logs from participants  for the specified evaluation.

### Example

```ts
import {
  Configuration,
  LogApi,
} from '';
import type { PostApiV2LogResultByEvaluationIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LogApi();

  const body = {
    // string | The evaluation ID.
    evaluationId: evaluationId_example,
    // string | Session Token
    session: session_example,
    // QueryResultLog (optional)
    queryResultLog: ...,
  } satisfies PostApiV2LogResultByEvaluationIdRequest;

  try {
    const data = await api.postApiV2LogResultByEvaluationId(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **evaluationId** | `string` | The evaluation ID. | [Defaults to `undefined`] |
| **session** | `string` | Session Token | [Defaults to `undefined`] |
| **queryResultLog** | [QueryResultLog](QueryResultLog.md) |  | [Optional] |

### Return type

[**SuccessStatus**](SuccessStatus.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **400** | Bad Request |  -  |
| **401** | Unauthorized |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

