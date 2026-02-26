
# ApiTeam


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`color` | string
`users` | [Array&lt;ApiUser&gt;](ApiUser.md)
`logoData` | string
`teamId` | string

## Example

```typescript
import type { ApiTeam } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "color": null,
  "users": null,
  "logoData": null,
  "teamId": null,
} satisfies ApiTeam

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiTeam
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


