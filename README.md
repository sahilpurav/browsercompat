[![CircleCI](https://circleci.com/gh/sahilpurav/browsercompat.svg?style=svg)](https://circleci.com/gh/sahilpurav/browsercompat)

# Browser compatibilty linter for TSLint
Introducing super slick browser compatibility check module, built on the top of reliable MDN database.

# Installation
- Install the plugin with following command: `npm i browsercompat --save-dev`
- Open tslint.json and add code inside `rulesDirectory` option, `"node_modules/browsercompat/dist"`
For Angular project, it should look like this: `"rulesDirectory": ["codelyzer", "node_modules/browsercompat/dist"],`

# Usage

Following is the schema needed to add inside tslint.json:

```
"rules": {
    "supported-browsers": {
        "options": {
            "targets": {
                "ie": 11,
                "chrome": 60,
                "safari": 10,
                "firefox": 60
            },
            "whitelist": [
                "Promise",
                "Promise.*",
                "Object.assign",
                "Array.from",
                "Array.find",
                "Set.add",
                "Set",
                "String.startsWith",
                "String.endsWith",
                "Array.fill",
                "String.repeat",
                "HTMLElement.style"
            ]
        }
    }
}
```

## Options
- **targets** - It contains the minimum browser name and minimum supported version.
- **whitelist** - If you've added polyfills for some unsupported function and you want to exclude this from the checks, you can it inside the whitelist section.