---
title: "対応できていない属性のパッチ"
---

このチャプターでは、現時点で対応できていない属性のパッチを実装していきましょう。  
以下にはいくつか例として対応対象を挙げますが、各自で足りてない所を本家の実装を読みながら実装してみましょう！  
そうすればより実用的なものにグレードアップするはずです！

特に新しいことは出てきません。今までやってきたことで十分実装できるはずです。

注目したいのは、runtime-dom/modules の実装です。

# class / style

class と style には複数のバインディング方法があります。

```html
<p class="static property">hello</p>
<p :class="'dynamic property'">hello</p>
<p :class="['dynamic', 'property', 'array']">hello</p>
<p :class="{ dynamic: true, property: true, array: true}">hello</p>
<p class="static property" :class="'mixed dynamic property'">hello</p>
<p style="static: true;" :style="{ mixed-dynamic: 'true' }">hello</p>
```

これらを実現するには、Basic Template Compiler 部門で説明する `transform` という概念が必要になります。  
本家 Vue の設計に則らなければどこに実装してもいいのですが、本書では 本家 Vue の設計に則りたいためここではスキップします。  


# DOM

## innerHTML / textContent

## value

### bool 値

### number 値
