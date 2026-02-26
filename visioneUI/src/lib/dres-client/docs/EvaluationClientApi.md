# EvaluationClientApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getApiV2ClientEvaluationCurrentTaskByEvaluationId**](EvaluationClientApi.md#getapiv2clientevaluationcurrenttaskbyevaluationid) | **GET** /api/v2/client/evaluation/currentTask/{evaluationId} | Returns an overview of the currently active task for a run. |
| [**getApiV2ClientEvaluationList**](EvaluationClientApi.md#getapiv2clientevaluationlist) | **GET** /api/v2/client/evaluation/list | Lists an overview of all evaluation runs visible to the current client. |



## getApiV2ClientEvaluationCurrentTaskByEvaluationId

> ApiClientTaskTemplateInfo getApiV2ClientEvaluationCurrentTaskByEvaluationId(evaluationId, session)

Returns an overview of the currently active task for a run.

### Example

```ts
import {
  Configuration,
  EvaluationClientApi,
} from '';
import type { GetApiV2ClientEvaluationCurrentTaskByEvaluationIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EvaluationClientApi();

  const body = {
    // string | The evaluation ID.
    evaluationId: evaluationId_example,
    // string | Session Token (optional)
    session: session_example,
  } satisfies GetApiV2ClientEvaluationCurrentTaskByEvaluationIdRequest;

  try {
    const data = await api.getApiV2ClientEvaluationCurrentTaskByEvaluationId(body);
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
| **session** | `string` | Session Token | [Optional] [Defaults to `undefined`] |

### Return type

[**ApiClientTaskTemplateInfo**](ApiClientTaskTemplateInfo.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **401** | Unauthorized |  -  |
| **404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getApiV2ClientEvaluationList

> Array&lt;ApiClientEvaluationInfo&gt; getApiV2ClientEvaluationList(session)

Lists an overview of all evaluation runs visible to the current client.

### Example

```ts
import {
  Configuration,
  EvaluationClientApi,
} from '';
import type { GetApiV2ClientEvaluationListRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new EvaluationClientApi();

  const body = {
    // string | Session Token (optional)
    session: session_example,
  } satisfies GetApiV2ClientEvaluationListRequest;

  try {
    const data = await api.getApiV2ClientEvaluationList(body);
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
| **session** | `string` | Session Token | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;ApiClientEvaluationInfo&gt;**](ApiClientEvaluationInfo.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **401** | Unauthorized |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

