---
title: "ちょっと一息"
---

# Minimal Example 部門はここまで！

冒頭で、この本はいくつかの部門に分かれるという話をしたのですが、それの一番最初の部門である「Minimal Example 部門」はここまでで終了です。お疲れ様でした。  
なぜ、わざわざ「部門」という呼び方にしているかというと、理由は２つあります。  
まず一つは、ここからはそれぞれの部門でなるべく依存関係を持たないような構成にすることで、それぞれが興味のある範囲(部門)での理解を深めることができるということを目指しているからです。  
仮想 DOM やパッチレンダリング周りに興味がある人は Basic Virtual DOM 部門に進めばいいですし、コンポーネントをもっと拡張したければ Basic Component 部門、  
テンプレートでもっと豊かな表現(ディレクティブなど)に興味があれば Basic Template Compiler 部門、script setup やコンパイラマクロに興味があれば Basic SFC Compiler 部門に進めば良いです。(勿論全部やってもいいですよ！！)  
そして何よりこのこの「Minimal Example 部門」もひとつの立派な部門なわけですから、「そんなに深くは知らなくてもいいけど、全体的にサラッとやりたい！」という方はここまでで十分なのです。  
(Web Application Essentials 部門に関しては、ある程度 Vue の Basic な実装に依存にする部分があるので、各部門の実装が少し混ざってしまっています。)

# ここまでで何ができるようになった？

最後に、少し Minimal Example 部門でやったこととできるようになったことを振り返ってみましょう。

## いつもみているものが何処の何なのか、分かるようになった

まず、createApp という最初の開発者インターフェースを通して、(Web アプリの)開発者と Vue の世界がどういうふうに繋がっているのかを理解しました。  
具体的には、最初にやったリファクタを起点に、Vue のディレクトリ構造の基盤とそれぞれの依存関係、そして開発者が触っている部分はどこのなんなのかというのが分かるようになっているはずです。
ここらで今現状でのディレクトリと、vuejs/core のディレクトリを見比べてみましょう。

chibivue
![minimum_example_artifacts](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/minimum_example_artifacts.png)

※ 本家のコードはデカてスクショに収まりきらないので割愛

https://github.com/vuejs/core

小さいなりに、それぞれのファイルの役割やその中身もそこそこ読めるようになっているのではないでしょうか。
ぜひ、今回触れていない部分のソースコードのコードリーディングにも挑戦してみてほしいです。(ぼちぼち読めるはずです！)

## 宣言的 UI の実現方法が分かった

h 関数の実装をとして、宣言的 UI はどうやって実現されているかということについて理解しました。

```ts
// 内部的に {tag, props, children} のようなオブジェクトを生成し、それを元にDOM操作をしている
h("div", { id: "my-app" }, [
  h("p", {}, ["Hello!"]),
  h(
    "button",
    {
      onClick: () => {
        alert("hello");
      },
    },
    ["Click me!"]
  ),
]);
```

ここで初めて仮想 DOM のようなものが登場しました。

## 仮想 DOM とはなんなのか、何が嬉しいのか、どうやって実装するのかが分かった

h 関数の内部処理として、仮想 DOM の比較による効率的なレンダリングの方法について理解しました。

```ts
// 仮想DOMのinterface
export interface VNode<HostNode = any> {
  type: string | typeof Text | object;
  props: VNodeProps | null;
  children: VNodeNormalizedChildren;
  el: HostNode | undefined;
}

// まず、render関数が呼ばれる
const render: RootRenderFunction = (rootComponent, container) => {
  const vnode = createVNode(rootComponent, {}, []);
  // 初回は n1 が null. この場合は各自 process で mount が走る
  patch(null, vnode, container);
};

const patch = (n1: VNode | null, n2: VNode, container: RendererElement) => {
  const { type } = n2;
  if (type === Text) {
    processText(n1, n2, container);
  } else if (typeof type === "string") {
    processElement(n1, n2, container);
  } else if (typeof type === "object") {
    processComponent(n1, n2, container);
  } else {
    // do nothing
  }
};

// 2回目以降はひとつ前のVNodeと現在のVNodeをpatch関数に渡すことで差分を更新する
const nextVNode = component.render();
patch(prevVNode, nextVNode);
```

## リアクティブシステムとは何か、どうやって画面を動的に更新していくかということが分かった

Vue の醍醐味である、リアクティブシステムがどういう実装で成り立っているのか、そもそもリアクティブシステムとはなんのことなのか、ということについて理解しました

```

```
