---
title: "小さいテンプレートコンパイラ"
---

# 実はここまでで動作に必要なものは揃った(?)

これまで、リアクティブシステムや仮想 DOM、コンポーネントシステムなどを実装してきました。  
これらは非常に小さなもので、実用的なものではないのですが、実は動作に必要な構成要素の全体像としては一通り理解できたと言っても過言ではないのです。  
それぞれの要素自体の機能は足りていないですが、浅〜〜〜〜〜く 1 周した感じです。

このチャプターからはより Vue.js に近づけるためにテンプレートの機能を実装するのですが、これらはあくまで DX の改善のためのものであり、ランタイムに影響を出すものではありません。  
もう少し具体的にいうと、DX の向上のために開発者インターフェースを拡張し、「最終的には今まで作った内部実装に変換」します。

# 今回実現したい開発者インターフェース

今現時点ではこのような開発者インターフェースになっています。

```ts
const MyComponent: Component = {
  props: { someMessage: { type: String } },

  setup(props: any, { emit }: any) {
    return () =>
      h("div", {}, [
        h("p", {}, [`someMessage: ${props.someMessage}`]),
        h("button", { onClick: () => emit("click:change-message") }, [
          "change message",
        ]),
      ]);
  },
};

const app = createApp({
  setup() {
    const state = reactive({ message: "hello" });
    const changeMessage = () => {
      state.message += "!";
    };

    return () =>
      h("div", { id: "my-app" }, [
        h(
          MyComponent,
          {
            "some-message": state.message,
            "onClick:change-message": changeMessage,
          },
          []
        ),
      ]);
  },
});
```

現状だと、View の部分は h 関数を使って構築しています。より生の HTML に近づけるために template オプションに template を描けるようにしたいです。
とは言っても、いきなり色々モリモリで実装するのは大変なので、少し機能を絞って作ってみます。とりあえず、以下のようなタスクに分割してやっていきます。

1. 単純なタグとメッセージ、静的な属性を描画できるように

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` });
```

2. もう少し複雑な HTML を描画できるように

```ts
const app = createApp({
  template: `
    <div>
      <p>hello</p>
      <button> click me! </button>
    </div>
  `,
});
```

3. setup 関数で定義したものを使えるようにしたい

```ts
const app = createApp({
  setup() {
    const count = ref(0);
    const increment = () => {
      count.value++;
    };

    return { count, increment };
  },

  template: `
    <div>
      <p>count: {{ count }}</p>
      <button v-on:click="increment"> click me! </button>
    </div>
  `,
});
```

それぞれでさらに小さく分割はしていくのですが、おおまかにこの 3 ステップに分割してみます。
まずは 1 からやっていきましょう。

# テンプレートコンパイラの第一歩

さて、今回目指す開発者インターフェースは以下のようなものです。

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` });
```

ここでまず、コンパイラとはいったいなんなのかという話だけしておきます。  
ソフトウェアを書いているとたちまち「コンパイラ」という言葉を耳にするかと思います。  
「コンパイル」というのは翻訳という意味で、ソフトウェアの領域だとより高級な記述から低級な記述へ変換する際によくこの言葉を使います。
この本の最初の方のこの言葉を覚えているでしょうか?

> ここでは便宜上、生の JS に近ければ近いほど「低級な開発者インターフェース」と呼ぶことにします。  
> そして、ここで重要なのが、「実装を始めるときは低級なところから実装していく」ということです。  
> それはなぜかというと、多くの場合、高級な記述は低級な記述に変換されて動いているからです。  
> つまり、1 も 2 も最終的には内部的に 3 の形に変換しているのです。  
> その変換の実装のことを「コンパイラ (翻訳機)」と呼んでいます。

では、このコンパイラというものがなぜ必要なのかということについてですが、それは「開発体験を向上させる」というのが大きな目的の一つです。  
最低限、動作するような低級なインターフェースが備わっていれば、機能としてはそれらだけで開発を進めることは可能です。  
ですが、記述がわかりづらかったり、機能に関係のない部分を考慮する必要が出てきたりと色々と面倒な問題がでてくるのはしんどいので、利用者の気持ちを考えてインターフェースの部分だけを再開発します。

この点で、Vue.js が目指している点は、「生の HTML のように書けかつ、Vue が提供する機能(ディレクティブなど)を活用して便利に View を書く」と言ったところでしょうか。
そして、そこの行き着く先が SFC といったところでしょうか。
昨今では jsx/tsx の流行もあり、Vue はもちろんこれらも開発者インターフェースの選択肢として提供しています。が、今回は Vue 独自の template を実装する方向でやってみようと思います。

長々と、文章で説明してしまいましたが、結局今回やりたいことは、

このようなコードを、

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` });
```

このように翻訳(コンパイル)する機能を実装したいです。

```ts
const app = createApp({
  render() {
    return h("p", { class: "hello" }, ["Hello World"]);
  },
});
```

もう少しスコープを狭めるなら、この部分です。

```ts
`<p class="hello">Hello World</p>`;
// ↓
h("p", { class: "hello" }, ["Hello World"]);
```

いくつかのフェーズに分けて、段階的に実装を進めていきましょう。

# 小さいコンパイラを実装してみる。

## 実装アプローチ

基本的なアプローチとしては、template オプションでで渡された文字列を操作して特定の関数を生成する感じです。  
コンパイラを３つの要素に分割してみます。

### 解析

解析(parse)は渡された文字列から必要な情報を解析します。以下のようなイメージをしてもらえれば OK です。

```ts
const { tag, props, textContent } = parse(`<p class="hello">Hello World</p>`);
console.log(tag); // "p"
console.log(prop); // { class: "hello" }
console.log(textContent); // "Hello World"
```

### コード生成

コード生成(codegen)では parse の結果をもとにコード(文字列)を生成します。

```ts
const code = codegen({ tag, props, textContent });
console.log(code); // "h('p', { class: 'hello' }, ['Hello World']);"
```

### 関数オブジェクト生成

codegen で生成したコード(文字列)をもとに実際に実行可能な関数を生成します。
JavaScript では、Function コンストラクタを利用することで文字列から関数を生成することが可能です。

```ts
const f = new Function("return 1");
console.log(f()); // 1

// 引数を定義する場合はこんな感じ
const add = new Function("a", "b", "return a + b");
console.log(add(1, 1)); // 2
```

これを利用して関数を生成します。
ここで一点注意点があるのですが、生成した関数はその中で定義された変数しか扱うことができないので、h 関数などの読み込みもこれに含んであげます。

```ts
import * as runtimeDom from "./runtime-dom";
const render = new Function("ChibiVue", code)(runtimeDom);
```

こうすると、ChibiVue という名前で runtimeDom を受け取ることができるので、codegen の段階で以下のように h 関数を読み込めるようにしておきます。

```ts
const code = codegen({ tag, props, textContent });
console.log(code); // "return () => { const { h } = ChibiVue; return h('p', { class: 'hello' }, ['Hello World']); }"
```
