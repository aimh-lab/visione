
# ApiTeamGroup


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`teams` | [Array&lt;ApiTeam&gt;](ApiTeam.md)
`aggregation` | [ApiTeamAggregatorType](ApiTeamAggregatorType.md)

## Example

```typescript
import type { ApiTeamGroup } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "teams": null,
  "aggregation": null,
} satisfies ApiTeamGroup

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiTeamGroup
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


