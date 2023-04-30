---
title: "バインディング"
---

# AST を元に render 関数を生成する

さて、本格的なパーサが実装できたところで次はそれに適応したコードジェネレータを作っていきます。  
と言っても今の時点だと複雑な実装は必要ありません。  
先にコードをお見せしてしまいます。

```ts
import { ElementNode, NodeTypes, TemplateChildNode, TextNode } from "./ast";

export const generate = ({
  children,
}: {
  children: TemplateChildNode[];
}): string => {
  return `return function render() {
  const { h } = ChibiVue;
  return ${genNode(children[0])};
}`;
};

const genNode = (node: TemplateChildNode): string => {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      return genElement(node);
    case NodeTypes.TEXT:
      return genText(node);
    default:
      return "";
  }
};

const genElement = (el: ElementNode): string => {
  return `h("${el.tag}", {${el.props
    .map(({ name, value }) => `${name}: "${value?.content}"`)
    .join(", ")}}, [${el.children.map((it) => genNode(it)).join(", ")}])`;
};

const genText = (text: TextNode): string => {
  return `\`${text.content}\``;
};
```

以上で動くようなものは作れます。
パーサの章でコメントアウトした部分を戻して、実際に動作を見てみましょう。
`~/packages/compiler-core/compile.ts`

```ts
export function baseCompile(template: string) {
  const parseResult = baseParse(template.trim());
  const code = generate(parseResult);
  return code;
}
```

playground

```ts
import { createApp } from "chibivue";

const app = createApp({
  template: `
    <div class="container" style="text-align: center">
      <h2>Hello, chibivue!</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <style>
        .container {
          height: 100vh;
          padding: 16px;
          background-color: #becdbe;
          color: #2c3e50;
        }
      </style>
    </div>
  `,
});

app.mount("#app");
```

![render_template](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/render_template.png)
どうでしょうか。とってもいいっ感じに画面を描画できているようです。

せっかくなので画面に動きをつけてみます。テンプレートへのバインディングは実装していないので、直接 DOM 操作します。

```ts
export type ComponentOptions = {
  // .
  // .
  // .
  setup?: (
    props: Record<string, any>,
    ctx: { emit: (event: string, ...args: any[]) => void }
  ) => Function | void; // voidも許可する
  // .
  // .
  // .
};
```

```ts
import { createApp } from "chibivue";

const app = createApp({
  setup() {
    // マウント後に DOM 操作をしたいので Promise.resolve で処理を遅らせる
    Promise.resolve(() => {
      const btn = document.getElementById("btn");
      btn &&
        btn.addEventListener("click", () => {
          const h2 = document.getElementById("hello");
          h2 && (h2.textContent += "!");
        });
    });
  },

  template: `
    <div class="container" style="text-align: center">
      <h2 id="hello">Hello, chibivue!</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <button id="btn"> click me! </button>

      <style>
        .container {
          height: 100vh;
          padding: 16px;
          background-color: #becdbe;
          color: #2c3e50;
        }
      </style>
    </div>
  `,
});

app.mount("#app");
```

これで正常に動作していることを確認します。  
どうでしょう。機能は少ないにしろ、だんだんと普段の Vue の開発者インターフェースに近づいてきたのではないでしょう

# テンプレートにバインドしたい

## 方針

今の状態だと、直接 DOM 操作をしているので、リアクティブシステムや仮想 DOM の恩恵を得ることができていません。  
実際にはイベントハンドラであったり、テキストの内容はテンプレート部分に書きたいわけです。それでこそ宣言的 UI の嬉しさと言った感じですよね。  
以下のような開発者インターフェースを目指します。

```ts
import { createApp, reactive } from "chibivue";

const app = createApp({
  setup() {
    const state = reactive({ message: "Hello, chibivue!" });
    const changeMessage = () => {
      state.message += "!";
    };

    return { state, changeMessage };
  },

  template: `
    <div class="container" style="text-align: center">
      <h2>message: {{ state.message }}</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <button @click="changeMessage"> click me! </button>

      <style>
        .container {
          height: 100vh;
          padding: 16px;
          background-color: #becdbe;
          color: #2c3e50;
        }
      </style>
    </div>
  `,
});

app.mount("#app");
```

setup から return した値をテンプレートに記述して扱えるようにしたいのですが、このことをこれからは「テンプレートバインディング」であったり、単に「バインディング」という言葉で表現することにします。  
バインディングをこれから実装していくわけですがイベントハンドラやマスタッシュ構文を実装する前にやっておきたいことがあります。  
`setup から return した値`と言ったのですが、今 setup の戻り値は`undefined`または、`関数｀(レンダー関数)です。  
バインディングの実装の準備として、setup からステート等を return できるようにして、それらをコンポーネントのデータとして保持できるようにしておく必要があるようです。

```ts
export type ComponentOptions = {
  setup?: (
    props: Record<string, any>,
    ctx: { emit: (event: string, ...args: any[]) => void }
  ) => Function | Record<string, unknown> | void; // Record<string, unknown>も返しうるように
  // .
  // .
  // .
};
```

```ts
export interface ComponentInternalInstance {
  // .
  // .
  // .
  setupState: Data; // setup の結果はオブジェクトの場合はここに格納することにする
}
```

```ts
export const setupComponent = (instance: ComponentInternalInstance) => {
  const { props } = instance.vnode;
  initProps(instance, props);

  const component = instance.type as Component;
  if (component.setup) {
    const setupResult = component.setup(instance.props, {
      emit: instance.emit,
    }) as InternalRenderFunction;

    // setupResultの型によって分岐をする
    if (typeof setupResult === "function") {
      instance.render = setupResult;
    } else if (typeof setupResult === "object" && setupResult !== null) {
      instance.setupState = setupResult;
    } else {
      // do nothing
    }
  }
  // .
  // .
  // .
};
```

伴って、これ以降、setup で定義されるデータのことを`setupState`と呼ぶことにします。

さて、コンパイラを実装する前に、setupState をどのようにしてテンプレートにバインディングするか方針について考えてみます。  
テンプレートを実装する前までは以下のように setupState をバインディングしていました。

```ts
const app = createApp({
  setup() {
    const state = reactive({ message: "hello" });
    return () => h("div", {}, [state.message]);
  },
});
```

まぁ、バインドというより普通に render 関数がクロージャを形成し変数を参照しているだけです。  
しかし今回は、イメージ的には setup オプションと render 関数は別のものなので、どうにかして render 関数に setup のデータを渡す必要があります。

```ts
const app = createApp({
  setup() {
    const state = reactive({ message: "hello" });
    return { state };
  },

  // これはrender関数に変換される
  template: "<div>{{ state.message }}</div>",
});
```

template は h 関数を使った render 関数として compile され、instance.render に突っ込まれるわけなので、イメージ的には以下のようなコードと同等になります。

```ts
const app = createApp({
  setup() {
    const state = reactive({ message: "hello" });
    return { state };
  },

  render() {
    return h("div", {}, [state.message]);
  },
});
```

当然、render 関数内では`state`という変数は定義されていません。  
そこで、render 関数の引数として setupState を受け取るようにしてみましょう。

```ts
const app = createApp({
  setup() {
    const state = reactive({ message: "hello" });
    return { state };
  },

  render(_ctx) {
    return h("div", {}, [_ctx.state.message]);
  },
});
```

実際には、setupState だけではなく、props のデータや OptionsApi で定義されたデータにもアクセスできるようになる必要があるのですが、今回は一旦 setupState のデータのみ使える形で良しとします。  
(この辺りの実装は最小構成部門では取り上げず、後の部門で取り上げます。)

つまり以下のようなテンプレートは

```html
<div>
  <p>{{ state.message }}</p>
  <button @click="changeMessage">click me</button>
</div>
```

以下のような関数にコンパイルするようにすれば良いわけです。

```ts
(_ctx) =>
  h("div", {}, [
    h("p", {}, [_ctx.state.message]),
    h("button", { onClick: _ctx.changeMessage }, ["click me"]),
  ]);
```

## マスタッシュ構文の実装

まずはマスタッシュ構文の実装をしていきます。例によって、AST を考え、パーサの実装してコードジェネレータの実装をしていきます。  
今現時点で AST の Node として定義されているのは Element と Text と Attribute 程度です。  
新たにマスタッシュ構文を定義したいので、直感的には `Mustache`のような AST にすることが考えられます。
それにあたるのが`Interpolation`という Node です。
Interpolation には「内挿」であったり、「挿入」と言った意味合いがあります。
よって、今回扱う AST は次のようなものになります。

```ts
export const enum NodeTypes {
  ELEMENT,
  TEXT,
  INTERPOLATION, // 追加

  ATTRIBUTE,
}

export type TemplateChildNode = ElementNode | TextNode | InterpolationNode; // InterpolationNodeを追加

export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION;
  content: string; // マスタッシュの中に記述された内容 (今回は　setup で定義された単一の変数名がここに入る)
}
```

ここで一つ注意点と言っては何ですが、マスタッシュは JavaScript の式をテンプレートに埋め込むためのものです。
なので、実際には

```html
{{ 999 }} {{ 1 + 2}} {{ message + "!" }} {{ getMessage() }}
```

などのようなコードにも対応する必要があります。  
が、今回は、**setup で定義された単一の変数**のみバインドすることを考えます。  
(この辺りの実装は最小構成部門では取り上げず、後の部門で取り上げます。)
具体的には以下のようなものです。

```html
{{ message }}
```

AST が実装できたので、パースの実装をやっていきます。
`{{`という文字列を見つけたら Interpolation としてパースします。

```ts
context: ParserContext,
  ancestors: ElementNode[]
): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = [];

  while (!isEnd(context, ancestors)) {
    const s = context.source;
    let node: TemplateChildNode | undefined = undefined;

    if (startsWith(s, "{{")) { // ここ
      node = parseInterpolation(context);
    } else if (s[0] === "<") {
      if (/[a-z]/i.test(s[1])) {
        node = parseElement(context, ancestors);
      }
    }
    // .
    // .
    // .
```

```ts
function parseInterpolation(
  context: ParserContext
): InterpolationNode | undefined {
  const [open, close] = ["{{", "}}"];
  const closeIndex = context.source.indexOf(close, open.length);
  if (closeIndex === -1) return undefined;

  const start = getCursor(context);
  advanceBy(context, open.length);

  const innerStart = getCursor(context);
  const innerEnd = getCursor(context);
  const rawContentLength = closeIndex - open.length;
  const rawContent = context.source.slice(0, rawContentLength);
  const preTrimContent = parseTextData(context, rawContentLength);

  const content = preTrimContent.trim();

  const startOffset = preTrimContent.indexOf(content);

  if (startOffset > 0) {
    advancePositionWithMutation(innerStart, rawContent, startOffset);
  }
  const endOffset =
    rawContentLength - (preTrimContent.length - content.length - startOffset);
  advancePositionWithMutation(innerEnd, rawContent, endOffset);
  advanceBy(context, close.length);

  return {
    type: NodeTypes.INTERPOLATION,
    content,
    loc: getSelection(context, start),
  };
}
```

これまでパーサを実装してきた方にとっては特に難しいことはないはずです。`{{`を探し、`}}`が来るまで読み進めて AST を生成しているだけです。  
`}}`が見つからなかった場合は undefined を返し、parseText への分岐でテキストとしてパースさせています。

ここらでちゃんとパースができているか、コンソール等に出力して確認してみましょう。

```ts
const app = createApp({
  setup() {
    const state = reactive({ message: "Hello, chibivue!" });
    const changeMessage = () => {
      state.message += "!";
    };

    return { state, changeMessage };
  },
  template: `
    <div class="container" style="text-align: center">
      <h2>{{ message }}</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <button> click me! </button>

      <style>
        .container {
          height: 100vh;
          padding: 16px;
          background-color: #becdbe;
          color: #2c3e50;
        }
      </style>
    </div>
  `,
});
```

![parse_interpolation](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/parse_interpolation.png)

問題なさそうです！

<!-- ちゃんと動いているようなのでコンパイラ実装を始める際に分割した 3 つのタスクを実装し終えました。やったね！ -->
