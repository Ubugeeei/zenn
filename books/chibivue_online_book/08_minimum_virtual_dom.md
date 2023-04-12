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

まず、patch 関数でやりたいことは 2 つの vnode の比較なので、便宜上しぞれ vnode1, vnode2 とするのですが、初回は vnode1 がありません。
つまり、patch 関数での処理は「初回(vnode2 から dom を生成)」と、「vnode1 と vnode2 の差分を更新」の処理に分かれます。
そしてそれらは ElementNode と TextNode それぞれで行うようにします。

```ts
const patch = (
  n1: VNode | string | null,
  n2: VNode | string,
  container: HostElement
) => {
  if (typeof n2 === "object") {
    processElement(n1, n2, container);
  } else {
    processText(n1, n2, container);
  }
};

const processElement = (
  n1: VNode | null,
  n2: VNode,
  container: HostElement
) => {
  if (n1 === null) {
    mountElement(n2, container);
  } else {
    patchElement(n1, n2);
  }
};

const processText = (n1: string | null, n2: string, container: HostElement) => {
  if (n1 === null) {
    mountText(n2, container);
  } else {
    patchText(n1, n2);
  }
};
```

# 実際に実装してみる

まず、 Element にに関してですが、マウントした段階で vnode に実際の DOM への参照を持たせておきたいので、vnode の el というプロパティを持たせておきます。

`~/packages/runtime-core/vnode.ts`

```ts
export interface VNode<HostNode = RendererNode> {
  type: string;
  props: VNodeProps;
  children: (VNode | string)[];

  el: HostNode | undefined; // 追加
}
```

それではここからは`~/packages/runtime-core/renderer.ts`です。  
createRenderer 関数の中に実装していきましょう。
renderVNode 関数は消してしまいます。

```ts
export function createRenderer(options: RendererOptions) {
  // .
  // .
  // .

  const patch = (
    n1: VNode | string | null,
    n2: VNode | string,
    container: RendererElement
  ) => {
    if (typeof n2 === "object") {
      // processElement(n1, n2, container);
    } else {
      // processText(n1, n2, container);
    }
  };
}
```

processElement の mountElement から実装していきます。

```ts
const processElement = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement
) => {
  if (n1 === null) {
    mountElement(n2, container);
  } else {
    // patchElement(n1, n2);
  }
};

const mountElement = (vnode: VNode, container: RendererElement) => {
  let el: RendererElement;
  const { type, props } = vnode;
  el = vnode.el = hostCreateElement(type as string);

  mountChildren(vnode.children, el); // TODO:

  if (props) {
    for (const key in props) {
      hostPatchProp(el, key, props[key]);
    }
  }

  hostInsert(el, container);
};
```

要素なので、当然小要素のマウントも必要です。

```ts
const mountChildren = (
  children: (VNode | string)[],
  container: RendererElement
) => {
  for (let i = 0; i < children.length; i++) {
    patch(null, children[i], container);
  }
};
```

ここまでで要素のマウントは実装できました。  
次は Text のマウントからやりましょう。と、言ってもこちらはただ DOM 操作をするだけです。

```ts
const processText = (
  n1: string | null,
  n2: string,
  container: RendererElement
) => {
  container.textContent = n2;
};
```

一旦ここまでで、初回のマウントはできるようになったはずので、render 関数で patch 関数をしようして playground で試してみましょう。
今まで、createAppAPI の mount に書いていた処理を一部 render 関数に移植して、２つの vnode を保持できるようにします。
具体的には。render 関数に rootComponent を渡して、その中で ReactiveEffect の登録等を行うように変更します。

```ts
return function createApp(rootComponent) {
    const app: App = {
      mount(rootContainer: HostElement) {
        // rootComponentを渡すだけに
        render(rootComponent, rootContainer);
      },
    };

```

```ts
const render: RootRenderFunction = (rootComponent, container) => {
  const componentRender = rootComponent.setup!();

  let n1: VNode | null = null;
  let n2: VNode = null!;

  const updateComponent = () => {
    const n2 = componentRender();
    patch(n1, n2, container);
    n1 = n2;
  };

  const effect = new ReactiveEffect(updateComponent);
  effect.run();
};
```

ここまでできたら playground で描画できるかどうか試してみましょう！

まだ、patch の処理は行なっていないので画面の更新は行われません。

と、言うことで引き続き patch の処理を書いていきましょう。

```ts
const patchElement = (n1: VNode, n2: VNode) => {
  const el = (n2.el = n1.el!);

  const props = n2.props;

  patchChildren(n1, n2, el);

  for (const key in props) {
    if (props[key] !== n1.props[key]) {
      hostPatchProp(el, key, props[key]);
    }
  }
};

const patchChildren = (n1: VNode, n2: VNode, container: RendererElement) => {
  const c1 = n1 && n1.children;
  const c2 = n2.children;

  for (let i = 0; i < c2.length; i++) {
    patch(c1[i], c2[i], container);
  }
};
```

※ patchChildren に関して、本来は key 属性などを付与して動的な長さの子要素に対応したりしないといけないのですが、今回は小さく仮想 DOM を実装するのでその辺の実用性については触れません。  
そのあたりをやりたい方は Basic Virtual Dom 部門で説明するのでぜひそちらをご覧ください。ここでは仮想 DOM の実装雰囲気であったり、役割が理解できるところまでの理解を目指します。

さて、これで差分レンダリングができるようになったので、playground を見てみましょう。

![patch_rendering](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/patch_rendering.png)

これで仮想 DOM を利用したパッチが実装できました!!!!! 祝
