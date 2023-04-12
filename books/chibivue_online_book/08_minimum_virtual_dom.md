---
title: "小さい仮想DOMシステム"
---

# 仮想 DOM、何に使われる?

前のチャプターでリアクティブシステムを導入したことで画面を動的に更新できるようになりました。
改めて現在の render 関数の内容を見てみましょう。

```ts
const render: RootRenderFunction = (vnode, container) => {
  while (container.firstChild) container.removeChild(container.firstChild);
  const el = renderVNode(vnode);
  hostInsert(el, container);
};
```

前のチャプターの時点で「これはヤバそうだ」と気づいた人ももしかしたらいるかもしれません。
この関数にはとんでもない無駄が存在します。

playground を見てみてください。

```ts
const app = createApp({
  setup() {
    const state = reactive({ count: 0 });
    const increment = () => state.count++;

    return function render() {
      return h("div", { id: "my-app" }, [
        h("p", {}, [`count: ${state.count}`]),
        h("button", { onClick: increment }, ["increment"]),
      ]);
    };
  },
});
```

何がまずいかというと、increment を実行した時に変化数部分は、``count: ${state.count}`の部分だけなのに、renderVNode では一度全ての DOM を削除し、1 から再生成しているのです。  
これはなんとも無駄だらけな感じがしてなりません。今はまだ小さいので、これくらいでも特に問題なく動いているように見えますが、普段 Web アプリケーションを開発しているときような複雑な DOM を毎度毎度丸ごと作り替えるととんでもなくパフォーマンスが落ちてしまうのが容易に想像できると思います。  
そこで、せっかく仮想 DOM を持っているわけですから、画面を描画する際に、前の仮想 DOM と比較して差分があったところだけを DOM 操作で書き換えるような実装をしたくなります。  
さて、今回のメインテーマはこれです。

やりたいことをソースコードベースで見てみましょう。
上記のようなコンポーネントがあったとき、render 関数の戻り値は以下のような仮想 DOM になっています。
初回のレンダリング時には count は 0 なので以下のようになります。

```ts
const vnode = {
  type: "div",
  props: { id: "my-app" },
  children: [
    {
      type: "p",
      props: {},
      children: [`count: 0`]
    },
    {
      type: "button",
      { onClick: increment },
      ["increment"]
    }
  ]
}
```

この vnode を持っておいて、次のレンダリングの時の vnode はまた別で持つことにしましょう。以下は 1 回目のボタンがクリックされた時の vnode です。

```ts
const nextVnode = {
  type: "div",
  props: { id: "my-app" },
  children: [
    {
      type: "p",
      props: {},
      children: [`count: 1`] // ここだけ更新したいなぁ〜
    },
    {
      type: "button",
      { onClick: increment },
      ["increment"]
    }
  ]
}
```

今、vnode と、nextVnode の 2 つを持っている状態で、画面は vnode の状態です(nextVnode になる前)
これら二つを patch という関数に渡してあげて、差分だけレンダリングするようにしたいです。

```ts
const vnode = {...}
const nextVnode = {...}
patch(vnode, nextVnode, container)
```

先に関数名を紹介してしまいましたが、この差分レンダリングは「パッチ」と呼ばれます。差分検出処理 (reconciliation)と呼ばれることもあるようです。
このように 2 つの仮想 DOM を利用することで効率的に画面の更新を行うことができます。

# patch 関数の設計
