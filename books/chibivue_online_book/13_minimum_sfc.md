---
title: "Single File Component で開発したい！"
---

# SFC、どうやって実現している？

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

## エラーの解消

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

# パーサの実装 on compiler-sfc

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

ここまでのソースコード:  
https://github.com/Ubugeeei/chibivue/tree/main/books/chapter_codes/08-2_mininum_sfc_compiler

# template 部分のコンパイル

`descriptor.script.content` と `descriptor.template.content`にはそれぞれのソースコードが入っています。  
これらを使って上手くコンパイルしたいです。template の方からやっていきましょう。  
テンプレートのコンパイラはすでに持っています。  
しかし、以下のコードを見てもらえればわかるのですが、

```ts
export const generate = ({
  children,
}: {
  children: TemplateChildNode[];
}): string => {
  return `return function render(_ctx) {
  const { h } = ChibiVue;
  return ${genNode(children[0])};
}`;
};
```

これは Function コンストラクタで new する前提の物になってしまっているので先頭に return がついてしまっています。
SFC のコンパイラでは render 関数だけを生成したいので、コンパイラのオプションで分岐できるようにしましょう。
コンパイラの第 2 引数としてオプションを受け取れるようにし、'isBrowser'というフラグを指定可能にします。
この変数が true の時はランタイム上で new される前提のコードを出力し、false の場合は単にコードを生成します。

```sh
pwd # ~
touch packages/compiler-core/options.ts
```

`packages/compiler-core/options.ts`

```ts
export type CompilerOptions = {
  isBrowser?: boolean;
};
```

`~/packages/compiler-dom/index.ts`

```ts
export function compile(template: string, option?: CompilerOptions) {
  const defaultOption: Required<CompilerOptions> = { isBrowser: true };
  if (option) Object.assign(defaultOption, option);
  return baseCompile(template, defaultOption);
}
```

`~/packages/compiler-core/compile.ts`

```ts
export function baseCompile(
  template: string,
  option: Required<CompilerOptions>
) {
  const parseResult = baseParse(template.trim());
  const code = generate(parseResult, option);
  return code;
}
```

`~/packages/compiler-core/codegen.ts`

```ts
export const generate = (
  {
    children,
  }: {
    children: TemplateChildNode[];
  },
  option: Required<CompilerOptions>
): string => {
  return `${option.isBrowser ? "return " : ""}function render(_ctx) {
  const { h } = ChibiVue;
  return ${genNode(children[0])};
}`;
};
```

これで render 関数をコンパイルできるようになっていると思います。ブラウザの source で確認してみましょう。  
ついでに import 文を足しておきました。output という配列にソースコードを詰めていく感じにも変更してます。

```ts
import type { Plugin } from "vite";
import { createFilter } from "vite";
import { parse } from "../../compiler-sfc";
import { compile } from "../../compiler-dom";

export default function vitePluginChibivue(): Plugin {
  const filter = createFilter(/\.vue$/);

  return {
    name: "vite:chibivue",

    transform(code, id) {
      if (!filter(id)) return;

      const outputs = [];
      outputs.push("import * as ChibiVue from 'chibivue'\n");

      const { descriptor } = parse(code, { filename: id });
      const templateCode = compile(descriptor.template?.content ?? "", {
        isBrowser: false,
      });
      outputs.push(templateCode);

      outputs.push("\n");
      outputs.push(`export default { render }`);

      return { code: outputs.join("\n") };
    },
  };
}
```

![compile_sfc_render](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/compile_sfc_render.png)

上手くコンパイルできているようです。あとは同じ要領で、どうにかして script を引っこ抜いて default exports に突っ込めば OK です。

ここまでのソースコード:  
https://github.com/Ubugeeei/chibivue/tree/main/books/chapter_codes/08-3_mininum_sfc_compiler

# script 部分のコンパイル

さて、元々の SFC の script 部分は以下のようになっています。

```ts
export default {
  setup() {},
};
```

これらを先ほど生成した render 関数といい感じに mix して export したいのですが、どうにか

```ts
{
  setup() {},
}
```

の部分だけ取り出せないでしょうか？

もしこの部分を取り出すことができたら、
以下のようにしてあげれば良いことになります。

```ts
const _sfc_main = {
  setup() {},
};

export default { ..._sfc_main, render };
```

## 外部ライブラリを使う

上記のようなことをしたいのですが結論から言うと以下の 2 つのライブラリを使って楽に実装します。

- @babel/parser
- magic-string

### Babel

https://babeljs.io

[What is Babel](https://babeljs.io/docs)

こちらは普段 JavaScript を使っている方はよく聞くかも知れません。  
Babel は JavaScript の後方互換バージョンに変換するために使用されるツールチェーンです。  
簡単に言うと、JS から JS へのコンパイラ(トランスパイラ)です。  
今回は Babel をコンパイラとしてだけではなく、パーサとして利用します。  
Babel はコンパイラとしての役割を持つので、もちろん内部では AST に変換するためのパーサを実装しています。  
そのパーサをライブラリとして利用ます。  
さらっと AST という言葉を出しましたが、JavaScript ももちろん AST としての表現を持っています。  
こちらに AST の仕様があります。(https://github.com/estree/estree)  
上記の github の md ファイルを見てもらっても良いのですが、簡単に JavaScript の AST について説明しておくと、  
まずプログラム全体は Program という AST ノードで表現されていて、Statement を配列で持ちます。(わかりやすいように TS の interface で表現しています。)

```ts
interface Program {
  body: Statement[];
}
```

Statement というのは日本で言うと「文」です。JavaScript は文の集まりです。具体的には「変数宣言文」や「if 文」、「for 文」、「ブロック」などが挙げられます。

```ts
interface Statement {}

interface VariableDeclaration extends Statement {
  /* 省略 */
}

interface IfStatement extends Statement {
  /* 省略 */
}

interface ForStatement extends Statement {
  /* 省略 */
}

interface BlockStatement extends Statement {
  body: Statement[];
}
// 他にもたくさんある
```

そして、文というのは多くの場合「Expression(式)」を持ちます。式というのは変数に代入できる物だと考えてもらえらば良いです。具体的には「オブジェクト」や「2 項演算」、「関数呼び出し」などが挙げられます。

```ts
interface Expression {}

interface BinaryExpression extends Expression {
  operator: "+" | "-" | "*" | "/"; // 他にもたくさんあるが省略
  left: Expression;
  right: Expression;
}

interface ObjectExpression extends Expression {
  properties: Property[]; // 省略
}

interface CallExpression extends Expression {
  callee: Expression;
  arguments: Expression[];
}

// 他にもたくさんある
```

if 文について考えると、このような構造をとることがわかります。

```ts
interface IfStatement extends Statement {
  test: Expression; // 条件値
  consequent: Statement; // 条件値がtrueの場合に実行される文
  alternate: Statement | null; // 条件値がfalseの場合に実行される文
}
```

このように、JavaScript の構文は上記のような AST にパースされるのです。既に chibivue のテンプレートのコンパイラを実装したみなさんにとっては分かりやすい話だと思います。(同じこと)

なぜ Babel を使うのかというと、理由は２つあって、1 つは単純にめんどくさいからです。パーサを実装したことあるみなさんなら estree を見ながら JS のパーサを実装することも技術的には可能かも知れません。
けど、とてもめんどくさいし、今回の「Vue の理解を深める」という点においてはあまり重要ではありません。もう一つの理由は本家 Vue もこの部分は Babel を使っているという点です。

### magic-string

https://github.com/rich-harris/magic-string

もう一つ使いたいライブラリがあります。こちらも本家の Vue が使っているライブラリです。  
こちらは文字列操作を便利にするライブラリです。

```ts
const input = "Hello";
const s = new MagicString(input);
```

のようにインスタンスを生成し、そのインスタンスに生えている便利なメソッドを利用して文字列操作をしていきます。
いくつか例をあげます。

```ts
s.append("!!!"); // 末尾に追加する
s.prepend("message: "); // 先頭に追加する
s.overwrite(9, 13, "こんにちは"); // 範囲を指定して上書き
```

特に無理して使う必要はないのですが、本家の Vue に合わせて使うことにします。

Babel にしろ magic-string にしろ、実際の使い方等は実装の段階で合わせて説明するのでなんとなくの理解で問題ないです。

## script の default export を書き換える
