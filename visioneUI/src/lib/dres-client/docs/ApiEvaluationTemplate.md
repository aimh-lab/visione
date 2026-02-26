
# ApiEvaluationTemplate


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`description` | string
`created` | number
`modified` | number
`taskTypes` | [Array&lt;ApiTaskType&gt;](ApiTaskType.md)
`taskGroups` | [Array&lt;ApiTaskGroup&gt;](ApiTaskGroup.md)
`tasks` | [Array&lt;ApiTaskTemplate&gt;](ApiTaskTemplate.md)
`teams` | [Array&lt;ApiTeam&gt;](ApiTeam.md)
`teamGroups` | [Array&lt;ApiTeamGroup&gt;](ApiTeamGroup.md)
`judges` | Array&lt;string&gt;
`viewers` | Array&lt;string&gt;

## Example

```typescript
import type { ApiEvaluationTemplate } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "description": null,
  "created": null,
  "modified": null,
  "taskTypes": null,
  "taskGroups": null,
  "tasks": null,
  "teams": null,
  "teamGroups": null,
  "judges": null,
  "viewers": null,
} satisfies ApiEvaluationTemplate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiEvaluationTemplate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


