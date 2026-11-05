---
type: Ax
estado: 🔵
tags:
---
Borrando todos los archivos del proyecto y dejando main.ts de la siguiente manera, logré que funcionara la compilación sin problema de arranque. 


```ts
import { Plugin } from 'obsidian';

export default class MyPlugin extends Plugin {
    override async onload() {
        console.log('Loading MyPlugin...');

        this.addCommand({
            id: 'my-plugin-command',
            name: 'My Plugin Command',
            callback: () => {
                console.log('My Plugin Command executed!');
            }
        });
    }

    override onunload() {
        console.log('Unloading MyPlugin...');
    }
}
```

Sin los **overrides** no se dejaba compilar. 