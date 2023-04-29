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

<!-- ちゃんと動いているようなのでコンパイラ実装を始める際に分割した 3 つのタスクを実装し終えました。やったね！ -->
