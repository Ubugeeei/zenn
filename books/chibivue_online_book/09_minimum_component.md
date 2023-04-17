---
title: "コンポーネント志向で開発したい"
---

# 既存実装の整理ベースで考える

これまで、createAppAPI やリアクティブシステム、仮想 DOM システムを小さく実装してきました。  
今現時点での実装ではリアクティブシステムによって UI を動的に変更することもできますし、仮想 DOM によって効率的なレンダリングを行うことができているのですが、開発者インターフェースとしては全ての内容を createAppAPI に書く感じになってしまっています。  
実際にはもっとファイルを分割したり、再利用のために汎用的なコンポーネントを実装したいです。  
まずは既存実装の散らかってしまっている部分を見直してみます。renderer.ts の render 関数をみてください。

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

render 関数内にルートコンポーネントに関する情報を直接定義してしまっています。  
実際には、n1 や n2, updateComponent, effect は各コンポーネントごとに存在します。  
実際、これからはユーザー側でコンポーネント(ある意味でコンストラクタ)を定義してそれをインスタンス化したいわけです。  
そして、そのインスタンスが n1 や n2, updateComponent などを持つような感じにしたいです。  
そこで、コンポーネントのインスタンスとしてこれらを閉じ込めることについて考えてみます。

`~/packages/runtime-core/component.ts`に`ComponentInternalInstance`と言うものを定義してみます。
これがインスタンスの型となります。

```ts
export interface ComponentInternalInstance {
  type: ConcreteComponent; // 元となるユーザー定義のコンポーネント (旧 rootComponent (実際にはルートコンポーネントだけじゃないけど))
  vnode: VNode; // 後述
  subTree: VNode; // 旧 n1
  next: VNode | null; // 旧 n2
  effect: ReactiveEffect; // 旧 effect
  render: InternalRenderFunction; // 旧 componentRender
  update: () => void; // 旧 updateComponent
  isMounted: boolean;
}

export type InternalRenderFunction = {
  (): VNodeChild;
};
```

このインスタンスが持つ vnode と subTree と next は少しややこしいのですが、
これから、VNode の type として ConcreteComponent を指定できるように実装するのですが、instance.vnode にはその VNode 自体を保持しておきます。
そして、subTree, next というのはそのコンポーネントのレンダリング結果である VNode を保持させます。(ここは今までの n1 と n2 と変わらない)

イメージ的には、

```ts
const MyComponent = {
  setup() {
    return h("p", {}, ["hello"]);
  },
};

const App = {
  setup() {
    return h(MyComponent, {}, []);
  },
};
```

のように利用し、  
MyComponent のインスタンスを instance とすると、instance.vnode には`h(MyComponent, {}, [])`の結果が、instance.subTree には`h("p", {}, ["hello"])`の結果が格納される感じです。

とりあえず、h 関数の第一引数にコンポーネントを指定できるように実装してみましょう。  
-- TODO: ここにその実装を書く --

それに伴って、renderer の方でもコンポーネントを扱う必要が出てくるのですが、Element や Text と同様 processComponent を実装して、mountComponent と patchComponent も実装していきましょう。  
-- TODO: ここにその実装を書く --

これで Component をレンダリングすることができました。試しに playground コンポーネントを作ってみてみましょう。

# コンポーネント間のやりとり

-- TODO: ここ props/emit の実装を書く --
