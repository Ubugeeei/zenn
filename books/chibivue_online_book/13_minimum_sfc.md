---
title: "Single File Component で開発したい！"
---

# SFC、どうやっって実現している？

## 目標物

ここからはいよいよ SFC(Single File Component)の対応をやっていきます。  
さて、どのように対応していきましょう。SFC はテンプレートと同様、開発時に使われるものでランタイム上には存在しません。  
テンプレートの開発を終えたみなさんにとっては何をどのようにコンパイルすればいいかは簡単な話だと思います。

以下のような SFC を

```vue
<script>
export default {
  setup() {
    const state = reactive({ message: "Hello, chibivue!" });
    const changeMessage = () => {
      state.message += "!";
    };

    return { state, changeMessage };
  },
};
</script>

<template>
  <div class="container" style="text-align: center">
    <h2>message: {{ state.message }}</h2>
    <img
      width="150px"
      src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
    />
    <p><b>chibivue</b> is the minimal Vue.js</p>

    <button @click="changeMessage">click me!</button>
  </div>
</template>

<style>
.container {
  height: 100vh;
  padding: 16px;
  background-color: #becdbe;
  color: #2c3e50;
}
</style>
```

以下のような JS のコードに変換すれば良いのです。

```ts
export default {
  setup() {
    const state = reactive({ message: "Hello, chibivue!" });
    const changeMessage = () => {
      state.message += "!";
    };

    return { state, changeMessage };
  },

  render(_ctx) {
    return h("div", { class: "container", style: "text-align: center" }, [
      h("h2", `message: ${_ctx.state.message}`),
      h("img", {
        width: "150px",
        src: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png",
      }),
      h("p", [h("b", "chibivue"), " is the minimal Vue.js"]),
      h("button", { onClick: _ctx.changeMessage }, "click me!"),
    ]);
  },
};
```

(えっスタイルは!? と思った方もいるかも知ればせんが、一旦そのことは忘れて template と script について考えてみましょう。)

## どのタイミングでいつどうやってコンパイルするの？

結論から言ってしまうと、「ビルドツールが依存を解決するときにコンパイラを噛ませる」です。
多くの場合 SFC は他のファイルから import して使います。
この時に、`.vue` というファイルが解決される際にコンパイルをして、結果を App にバインドさせるようなプラグインを書きます。

```ts
import App from "./App.vue"; // App.vueが読み込まれるときにコンパイル

const app = createApp(App);
app.mount("#app");
```

さまざまなビルドツールがありますが、今回は vite のプラグインを書いてみます。

vite のプラグインを書いたことのない方も少ないと思うので、まずは簡単なサンプルコードでプラグインの実装に慣れてみましょう。
とりあえず簡単な vue のプロジェクトを作ってみます。

```sh
pwd # ~
pnpx create-vite
# ✔ Project name: … plugin-sample
# ✔ Select a framework: › Vue
# ✔ Select a variant: › TypeScript

cd plugin-sample
pnpm i
```

作った PJ の vite.config.ts を見てみましょう。

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
});
```

何やら@vitejs/plugin-vue を plugin に追加しているのがわかるかと思います。  
実は、vite で vue の PJ を作るとき、SFC が使えているのはこれのおかげなのです。  
このプラグインには SFC のコンパイラが vite のプラグインの API に沿って実装されていて、Vue ファイルを JS ファイルにコンパイルしています。  
このプロジェクトで簡単なプラグインを作ってみましょう。

```ts
import { defineConfig, Plugin } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), myPlugin()],
});

function myPlugin(): Plugin {
  return {
    name: "vite:my-plugin",

    transform(code, id) {
      if (id.endsWith(".sample.js")) {
        let result = "";

        for (let i = 0; i < 100; i++) {
          result += `console.log("HelloWorld from plugin! (${i})");\n`;
        }

        result += code;

        return { code: result };
      }
    },
  };
}
```

myPlugin という名前で作ってみました。  
簡単なので説明しなくても読める方も多いと思いますが一応説明しておきます。

プラグインは vite が要求する形式に合わせます。いろんなオプションがありますが、今回は簡単なサンプルなので transform オプションのみを使用しました。  
他は公式ドキュメント等を眺めてもらえるのがいいかと思います。https://vitejs.dev/guide/api-plugin.html

transform では`code`と`id`を受け取ることができます。code はファイルの内容、id はファイル名と思ってもらって良いです。
戻り値として、code というプロパティに成果物を突っ込みます。  
あとは id によってファイルの種類ごとに処理を書いたり、code をいじってファイルの内容を書き換えたりすれば OK です。  
今回は、`*.sample.js`というファイルに対して、ファイルの内容の先頭に console を 100 個数仕込むように書き換えてみました。  
では実際に、適当な plugin.sample.js を実装をして確認してみます。

```sh
pwd # ~/plugin-sample
touch src/plugin.sample.js
```

`~/plugin-sample/src/plugin.sample.js`

```ts
function fizzbuzz(n) {
  for (let i = 1; i <= n; i++) {
    i % 3 === 0 && i % 5 === 0
      ? console.log("fizzbuzz")
      : i % 3 === 0
      ? console.log("fizz")
      : i % 5 === 0
      ? console.log("buzz")
      : console.log(i);
  }
}

fizzbuzz(Math.floor(Math.random() * 100) + 1);
```

`~/plugin-sample/src/main.ts`

```ts
import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import "./plugin.sample.js"; // 追加

createApp(App).mount("#app");
```

ブラウザで確認してみましょう。

```sh
pwd # ~/plugin-sample
pnpm run dev
```

![sample_vite_plugin_console](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/sample_vite_plugin_console.png)

![sample_vite_plugin_source](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/sample_vite_plugin_source.png)

ちゃんとソースコードが改変されていることがわかります。

ここまでのソースコード:  
https://github.com/Ubugeeei/chibivue/tree/main/books/chapter_codes/08-1_mininum_sfc_compiler

# SFC コンパイラを実装していく

## 準備

先ほど作ったサンプルのプラグインなのですが、もう不要なので消してしまいましょう

```sh
pwd # ~
rm -rf ./plugin-sample
```

plugin の本体なのですが、本来これは vue/core の範囲外なので packages に`@extensions`というディレクトリを切ってそこに実装していきます。

```sh
pwd # ~
mkdir -p packages/@extensions/vite-plugin-chibivue
touch packages/@extensions/vite-plugin-chibivue/index.ts
```

`~/packages/@extensions/vite-plugin-chibivue/index.ts`

```ts
import type { Plugin } from "vite";

export default function vitePluginChibivue(): Plugin {
  return {
    name: "vite:chibivue",

    transform(code, id) {
      return { code };
    },
  };
}
```

ここから SFC のコンパイラを実装していくのですが、実態がないとイメージが湧きづらいかと思うので playground を実装してみて、動かしながらやっていこうかと思います。  
簡単な SFC とその読み込みを行います。

```sh
pwd # ~
touch playground/src/App.vue
```

`playground/src/App.vue`

```vue
<script>
import { reactive } from "chibivue";
export default {
  setup() {
    const state = reactive({ message: "Hello, chibivue!", input: "" });

    const changeMessage = () => {
      state.message += "!";
    };

    const handleInput = (e) => {
      state.input = e.target?.value ?? "";
    };

    return { state, changeMessage, handleInput };
  },
};
</script>

<template>
  <div class="container" style="text-align: center">
    <h2>{{ state.message }}</h2>
    <img
      width="150px"
      src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
    />
    <p><b>chibivue</b> is the minimal Vue.js</p>

    <button @click="changeMessage">click me!</button>

    <br />

    <input @input="handleInput" />
    <p>input value: {{ state.input }}</p>
  </div>
</template>

<style>
.container {
  height: 100vh;
  padding: 16px;
  background-color: #becdbe;
  color: #2c3e50;
}
</style>
```

`playground/src/main.ts`

```ts
import { createApp } from "chibivue";
import App from "./App.vue";

const app = createApp(App);

app.mount("#app");
```

`playground/vite.config.js`

```ts
import { defineConfig } from "vite";
import chibivue from "../../packages/@extensions/vite-plugin-chibivue";

export default defineConfig({
  resolve: {
    alias: {
      chibivue: `${process.cwd()}/../../packages`,
    },
  },
  plugins: [chibivue()],
});
```

この状態で起動してみましょう。

![vite_error](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/vite_error.png)

もちろんエラーになります。やったね(？)

## 初めての SFC コンパイラ

### エラーの解消

とりあえずエラーを解消していきましょう。いきなり完璧なものは目指しません。  
まず、transform の対象を「\*.vue」に限定してあげましょう。
sample でやったように id で分岐を書いてもいいのですが、せっかく vite から createFilter という関数が提供されているのでそれでフィルターを作ります。(特に理由はないです。)

`~/packages/@extensions/vite-plugin-chibivue/index.ts`

```ts
import type { Plugin } from "vite";
import { createFilter } from "vite";

export default function vitePluginChibivue(): Plugin {
  const filter = createFilter(/\.vue$/);

  return {
    name: "vite:chibivue",

    transform(code, id) {
      if (!filter(id)) return;
      return { code: `export default {}` };
    },
  };
}
```

フィルターを作り、vue ファイルだった場合はファイル内容 `export default {}` に transform してみました。  
おそらくエラーは消え、画面は何も表示されない感じになっているかと思います。

### パーサの実装 on compiler-sfc

さて、これではただのその場しのぎなのでちゃんとした実装をしていきます。  
vite-plugin での役割はあくまで vite を利用する際に vite で transform できるようにするためのものなので、パースやコンパイラは vue の本体にあります。  
それが`compiler-sfc`というディレクトリです。

```mermaid
  flowchart LR
    compiler-sfc["@vue/compiler-sfc"]
    compiler-dom["@vue/compiler-dom"]
    compiler-core["@vue/compiler-core"]
    vue["vue"]
    runtime-dom["@vue/runtime-dom"]
    runtime-core["@vue/runtime-core"]
    reactivity["@vue/reactivity"]

    subgraph "Runtime Packages"
      runtime-dom --> runtime-core
      runtime-core --> reactivity
    end

    subgraph "Compiler Packages"
      compiler-sfc --> compiler-core
      compiler-sfc --> compiler-dom
      compiler-dom --> compiler-core
    end

    vue ---> compiler-dom
    vue --> runtime-dom
```

https://github.com/vuejs/core/blob/main/.github/contributing.md#package-dependencies

SFC のコンパイラは vite だろうが webpack だろうがコアな部分は同じです。それらの実装をになっているのが`compiler-sfc`です。

`compiler-sfc`を作っていきましょう。

```sh
pwd # ~
mkdir packages/compiler-sfc
touch packages/compiler-sfc/index.ts
```

SFC のコンパイルでは `SFCDescriptor` というオブジェクトで SFC を表現します。

```sh
touch packages/compiler-sfc/parse.ts
```

`packages/compiler-sfc/parse.ts`

```ts
import { SourceLocation } from "../compiler-core";

export interface SFCDescriptor {
  id: string;
  filename: string;
  source: string;
  template: SFCTemplateBlock | null;
  script: SFCScriptBlock | null;
  styles: SFCStyleBlock[];
}

export interface SFCBlock {
  type: string;
  content: string;
  loc: SourceLocation;
}

export interface SFCTemplateBlock extends SFCBlock {
  type: "template";
}

export interface SFCScriptBlock extends SFCBlock {
  type: "script";
}

export declare interface SFCStyleBlock extends SFCBlock {
  type: "style";
}
```

まあ、特に難しいことはないです。SFC の情報をオブジェクトで表現しただけです。

`packages/compiler-sfc/parse.ts`では SFC ファイル(文字列)を `SFCDescriptor` にパースします。  
「ええ。あんだけテンプレートのパースを頑張ったのにまたパーサつくるのかよ。。面倒臭い。。」と思った方もいるかも知れませんが、安心してください。  
ここで実装するパーサは大したものではないです。というのも、これまで作ってきたものを組み合わせて template、script、style を分離するだけなので楽ちんです。

まず、下準備として以前作った template のパーサを export してあげます。

`~/packages/compiler-dom/index.ts`

```ts
import { baseCompile, baseParse } from "../compiler-core";

export function compile(template: string) {
  return baseCompile(template);
}

// パーサをexportしてあげる
export function parse(template: string) {
  return baseParse(template);
}
```

これらの interface を compiler-sfc 側で持っておいてあげます。

```sh
pwd # ~
touch packages/compiler-sfc/compileTemplate.ts
```

`~/packages/compiler-sfc/compileTemplate.ts`

```ts
import { TemplateChildNode } from "../compiler-core";

export interface TemplateCompiler {
  compile(template: string): string;
  parse(template: string): { children: TemplateChildNode[] };
}
```

あとはパーサを実装してあげるだけです。

`packages/compiler-sfc/parse.ts`

```ts
import { ElementNode, NodeTypes, SourceLocation } from "../compiler-core";
import * as CompilerDOM from "../compiler-dom";
import { TemplateCompiler } from "./compileTemplate";

/**
 * =========
 * 一部省略
 * =========
 */

export interface SFCParseOptions {
  filename?: string;
  sourceRoot?: string;
  compiler?: TemplateCompiler;
}

export interface SFCParseResult {
  descriptor: SFCDescriptor;
}

export const DEFAULT_FILENAME = "anonymous.vue";

export function parse(
  source: string,
  { filename = DEFAULT_FILENAME, compiler = CompilerDOM }: SFCParseOptions = {}
): SFCParseResult {
  const descriptor: SFCDescriptor = {
    id: undefined!,
    filename,
    source,
    template: null,
    script: null,
    styles: [],
  };

  const ast = compiler.parse(source);
  ast.children.forEach((node) => {
    if (node.type !== NodeTypes.ELEMENT) return;

    switch (node.tag) {
      case "template": {
        descriptor.template = createBlock(node, source) as SFCTemplateBlock;
        break;
      }
      case "script": {
        const scriptBlock = createBlock(node, source) as SFCScriptBlock;
        descriptor.script = scriptBlock;
        break;
      }
      case "style": {
        descriptor.styles.push(createBlock(node, source) as SFCStyleBlock);
        break;
      }
      default: {
        break;
      }
    }
  });

  return { descriptor };
}

function createBlock(node: ElementNode, source: string): SFCBlock {
  const type = node.tag;

  let { start, end } = node.loc;
  start = node.children[0].loc.start;
  end = node.children[node.children.length - 1].loc.end;
  const content = source.slice(start.offset, end.offset);

  const loc = { source: content, start, end };
  const block: SFCBlock = { type, content, loc };

  return block;
}
```

ここまでパーサを実装してきたみなさんにとっては簡単だと思います。  
実際に SFC を plugin 側でパースしてみましょう。

`~/packages/@extensions/vite-plugin-chibivue/index.ts`

```ts
import { parse } from "../../compiler-sfc";

export default function vitePluginChibivue(): Plugin {
  //.
  //.
  //.
  return {
    //.
    //.
    //.
    transform(code, id) {
      if (!filter(id)) return;
      const { descriptor } = parse(code, { filename: id });
      console.log(
        "🚀 ~ file: index.ts:14 ~ transform ~ descriptor:",
        descriptor
      );
      return { code: `export default {}` };
    },
  };
}
```

このコードは vite が動いているプロセス、つまり node で実行されるので console はターミナルに出力されているかと思います。

![parse_sfc1](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/parse_sfc1.png)

/_ 途中省略 _/

![parse_sfc2](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/parse_sfc2.png)

無事にパースできているようです。やったね！
