---
title: "初めてのレンダリングとcreateApp API"
---

# Vue.js の開発者インターフェース

## 何から始めよう? 🤔

さて、ここからどんどん chibivue を実装していきます。
どのように実装していくのがいいでしょうか ?

これは著者がいつも心がけていることですが、何か既存のソフトウェアを自作するときにはまずそのソフトウェアはどうやって使うのかということから考えます。  
この、「ソフトウェアを実際に使うときのインターフェース」のことをここからは便宜上「開発者インターフェース」と呼ぶことにします。  
ここでいう「開発者」とは、chibivue の開発者のことではなく、chibivue を使って Web アプリケーションを開発する人のことです。  
つまりは chibivue を開発するにあたって今一度本家 Vue.js の開発者インターフェースを参考にしてみます。  
具体的には Vue.js で Web アプリケーションを開発する際にまず何を書くかというところを見てみます。

## 開発者インターフェースのレベル? 🤔

ここで気をつけたいのは、Vue.js には複数の開発者インターフェースがあり、それぞれレベルが違うということです。  
ここでいうレベルというのは「どれくらい生の JavaScript に近いか」ということです。  
例えば、Vue で HTML を表示するための開発者インターフェースの例として以下のようなものが挙げられます。

1. Single File Component で template を書く

```vue
<!-- App.vue -->
<template>
  <div>Hello world.</div>
</template>
```

```ts
import { createApp } from "vue";
import App from "./App.vue";

const app = createApp(App);
app.mount("#app");
```

2. template オプションを使用する

```ts
import { createApp } from "vue";

const app = createApp({
  template: "<div>Hello world.</div>",
});

app.mount("#app");
```

3. render オプションと h 関数を利用する

```ts
import { createApp, h } from "vue";

const app = createApp({
  render() {
    return h("div", {}, ["Hello world."]);
  },
});

app.mount("#app");
```

他にもありますが、このような 3 つの開発者インターフェースについて考えてみます。  
どれが一番生の JavaScript に近いでしょうか?  
答えは、3 の`render オプションと h 関数を利用する`です。  
1 は SFC のコンパイラやそれらをバンドルするバンドラーの実装が必要ですし、2 は template に渡された HTML をコンパイル(そのままでは動かないので JS のコードに変換)する必要があります。

ここでは便宜上、生の JS に近ければ近いほど「低級な開発者インターフェース」と呼ぶことにします。  
そして、ここで重要なのが、「実装を始めるときは低級なところから実装していく」ということです。  
それはなぜかというと、多くの場合、高級な記述は低級な記述に変換されて動いているからです。  
つまり、1 も 2 も最終的には内部的に 3 の形に変換しているのです。  
その変換の実装のことを「コンパイラ (翻訳機)」と呼んでいます。

ということで、まずは 3 のような開発者インターフェースを目指して実装していきましょう!

# createApp API とレンダリング

## 方針

3 の形を目指すとはいったもののまだ h 関数についてはよく知らないですし、なんといってもこの本はインクリメンタルな開発を目指しているので、  
いきなり 3 の形を目指すのはやめて、以下のような形で render 関数ではメッセージを return してそれを表示するだけの実装をしてみましょう。

イメージ ↓

```ts
import { createApp } from "vue";

const app = createApp({
  render() {
    return "Hello world.";
  },
});

app.mount("#app");
```

## 早速実装

`~/packages/index.ts`に createApp 関数を作ってみましょう。
※ helloChibivue は不要なので消してしまいます。

```ts
export type Options = {
  render: () => string;
};

export type App = {
  mount: (selector: string) => void;
};

export const createApp = (options: Options): App => {
  return {
    mount: (selector) => {
      const root = document.querySelector(selector);
      if (root) {
        root.innerHTML = options.render();
      }
    },
  };
};
```

とても簡単ですね。playground の方で試してみましょう。

`~/examples/playground/src/main.ts`

```ts
import { createApp } from "chibivue";

const app = createApp({
  render() {
    return "Hello world.";
  },
});

app.mount("#app");
```

画面にメッセージを表示することができました! やったね!

![hello_createApp](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/hello_createApp.png)

## リファクタリング

「え？まだこれだけしか実装していないのにリファクタするの?」と思うかもしれませんが、この本の目的の一つに「Vue.js のソースコードを読めるようになる」というものがありました。  
それに伴って、ファイルやディレクトリ構成も Vue.js の形を常に意識したいわです。  
なので、少しばかりリファクタさせてください。。。

### VUe.js の設計

#### runtime-core と runtime-dom

ここで少し Vue.js 本家の構成についての説明です。  
今回のリファクタでは`runtime-core`というディレクトリと`runtime-dom`というディレクトリを作ります。  
それぞれなんなのかというと、runtime-core というのは、Vue.js のランタイム機能のうち本当にコアになる機能が詰まっています。  
と言われても何がコアで何がコアじゃないのか今の段階だとわかりづらいと思います。  
なので、runtime-dom との関係を見てみるとわかりやすいかなと思います。  
runtime-dom というのは名前の通り、DOM に依存した実装を置くディレクトリです。ざっくり「ブラウザに依存した処理」という理解をしてもらえれば問題ないです。  
例を挙げると querySelector や createElement などの DOM 操作が含まれます。  
runtime-core ではそういった処理書かず、あくまで純粋は TypeScript の世界の中で Vue.js のランタイムに関するコアロジックを記述するような設計になっています。  
例を挙げると、仮想 DOM に関する実装であったり、コンポーネントに関する実装だったりです。  
まあ、この辺りに関しては chibivue の開発が進むにつれて明確になってくると思うのでわからなかったらとりあえず本の通りにリファクタしてもらえれば問題ありません。

#### 各ファイルの役割と依存関係

これから runtime-core と runtime-dom にいくつかファイルを作ります。必要なファイルは以下のとおりです。

```sh
pwd # ~
mkdir packages/runtime-core
mkdir packages/runtime-dom

# core
touch packages/runtime-core/index.ts
touch packages/runtime-core/apiCreateApp.ts
touch packages/runtime-core/component.ts
touch packages/runtime-core/componentOptions.ts
touch packages/runtime-core/renderer.ts

# dom
touch packages/runtime-dom/index.ts
touch packages/runtime-dom/nodeOps.ts
```

これらの役割についてですが、最初から文章で説明してもわかりづらいかと思いますので以下の図を見てください。

![refactor_createApp!](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/refactor_createApp.png)



