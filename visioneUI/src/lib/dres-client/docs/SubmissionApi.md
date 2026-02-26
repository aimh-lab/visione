# SubmissionApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**postApiV2SubmitByEvaluationId**](SubmissionApi.md#postapiv2submitbyevaluationid) | **POST** /api/v2/submit/{evaluationId} | Endpoint to accept submissions. |



## postApiV2SubmitByEvaluationId

> SuccessfulSubmissionsStatus postApiV2SubmitByEvaluationId(evaluationId, apiClientSubmission, session)

Endpoint to accept submissions.

### Example

```ts
import {
  Configuration,
  SubmissionApi,
} from '';
import type { PostApiV2SubmitByEvaluationIdRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new SubmissionApi();

  const body = {
    // string | The ID of the evaluation the submission belongs to.
    evaluationId: evaluationId_example,
    // ApiClientSubmission | Some notes regarding the submission format. At least one answerSet is required, taskId, taskName are inferred if not provided,  at least one answer is required, mediaItemCollectionName is inferred if not provided,  start and end should be provided in milliseconds.For most evaluation setups, an answer is built in one of the three following ways: A) only text is required: just provide the text property with a meaningful entry B) only a mediaItemName is required: just provide the mediaItemName, optionally with the collection name. C) a specific portion of a mediaItem is required: provide mediaItemName, start and end, optionally with collection name
    apiClientSubmission: ...,
    // string | Session Token (optional)
    session: session_example,
  } satisfies PostApiV2SubmitByEvaluationIdRequest;

  try {
    const data = await api.postApiV2SubmitByEvaluationId(body);
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
| **evaluationId** | `string` | The ID of the evaluation the submission belongs to. | [Defaults to `undefined`] |
| **apiClientSubmission** | [ApiClientSubmission](ApiClientSubmission.md) | Some notes regarding the submission format. At least one answerSet is required, taskId, taskName are inferred if not provided,  at least one answer is required, mediaItemCollectionName is inferred if not provided,  start and end should be provided in milliseconds.For most evaluation setups, an answer is built in one of the three following ways: A) only text is required: just provide the text property with a meaningful entry B) only a mediaItemName is required: just provide the mediaItemName, optionally with the collection name. C) a specific portion of a mediaItem is required: provide mediaItemName, start and end, optionally with collection name | |
| **session** | `string` | Session Token | [Optional] [Defaults to `undefined`] |

### Return type

[**SuccessfulSubmissionsStatus**](SuccessfulSubmissionsStatus.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The submission was accepted by the server and there was a verdict |  -  |
| **202** | The submission was accepted by the server and there has not yet been a verdict available |  -  |
| **400** | Bad Request |  -  |
| **401** | Unauthorized |  -  |
| **404** | Not Found |  -  |
| **412** | The submission was rejected by the server |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

