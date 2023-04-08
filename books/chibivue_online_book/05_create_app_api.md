---
title: "初めてのレンダリングとcreateApp API"
---

# Vue.js の開発者インターフェース

さて、ここからどんどん chibivue を実装していきます。
どのように実装していくのがいいでしょうか ?

これは著者がいつも心がけていることですが、何か既存のソフトウェアを自作するときにはまずそのソフトウェアはどうやって使うのかということから考えます。  
この、「ソフトウェアを実際に使うときのインターフェース」のことをここからは便宜上「開発者インターフェース」と呼ぶことにします。  
ここでいう「開発者」とは、chibivue の開発者のことではなく、chibivue を使って Web アプリケーションを開発する人のことです。  
つまりは chibivue を開発するにあたって今一度本家 Vue.js の開発者インターフェースを参考にしてみます。  
具体的には Vue.js で Web アプリケーションを開発する際にまず何を書くかというところを見てみます。

まずは簡単な テキスト を表示することを考えてみます。以下のようになるでしょう。

```ts
import { createApp } from "vue";

const app = createApp({
  render() {
    return "Hello world.";
  },
});

app.mount("#app");
```

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
