
# DresInfo


## Properties

Name | Type
------------ | -------------
`version` | string
`startTime` | number
`uptime` | number
`os` | string
`jvm` | string
`args` | string
`cores` | number
`freeMemory` | number
`totalMemory` | number
`load` | number
`availableSeverThreads` | number

## Example

```typescript
import type { DresInfo } from ''

// TODO: Update the object below with actual values
const example = {
  "version": null,
  "startTime": null,
  "uptime": null,
  "os": null,
  "jvm": null,
  "args": null,
  "cores": null,
  "freeMemory": null,
  "totalMemory": null,
  "load": null,
  "availableSeverThreads": null,
} satisfies DresInfo

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DresInfo
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


