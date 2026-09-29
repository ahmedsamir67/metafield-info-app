# product-metafield-info

A Checkout UI extension that renders a product's `custom.shopping_note`
metafield underneath that product's line in the checkout order summary.

Products with no note render nothing at all.

## Why this is an extension and not a line item property

A line item property is data frozen onto the cart at add-to-cart time, and the
buyer's cart carries it around. This reads **live product data** at render time:
the merchant can edit the note in admin and the next checkout shows the new
text, with no change to any existing cart.

## How it works

```
Customer opens checkout
  -> Shopify renders the order summary
  -> loads this extension once PER CART LINE
       (target purchase.checkout.cart-line-item.render-after)
  -> shopify.target.value.merchandise.product.id  ...the product GID, free
  -> shopify.query(...)  ...Storefront GraphQL, one request per line
  -> Shopify resolves product -> metafield custom.shopping_note
  -> { value: "[\"Ships in a reinforced box\"]" }   ...JSON in a string
  -> JSON.parse -> array of notes
  -> <s-text> per note, rendered by Shopify under that line
```

## Prerequisites in the store

A **product** metafield definition:

| | |
|---|---|
| namespace.key | `custom.shopping_note` |
| type | `list.single_line_text_field` |
| storefront access | **`PUBLIC_READ`** |

`PUBLIC_READ` is not optional. Checkout extensions read through the Storefront
API, which returns `null` for a metafield without storefront access **and
raises no error**. The symptom is a blank render under every line with nothing
in the console.

The product must also be **active and published to the Online Store sales
channel**, or the Storefront API returns `null` for the product itself - the
same silent symptom, a different cause.

Verify both before debugging the code:

```graphql
# Admin API - is the definition storefront-readable?
query CheckShoppingNoteDefinition {
  metafieldDefinitions(first: 10, ownerType: PRODUCT, namespace: "custom") {
    nodes { name namespace key type { name } access { storefront } }
  }
}
```

## Config

`shopify.extension.toml`:

- `target = "purchase.checkout.cart-line-item.render-after"` - which slot.
  Declared, not inferred, because Shopify has to place the extension before it
  ever runs the code.
- `api_access = true` - what makes `shopify.query()` exist at all. Without it
  the method is absent, not merely unauthorized.
- `network_access` stays off. We make no calls outside Shopify.
- `uid` is CLI-generated. Never copy one from another project.

## Cost

One Storefront request per cart line. Four products in the cart means four
requests; the instances are isolated and cannot batch. If that ever matters,
the fix is architectural: `purchase.checkout.cart-line-list.render-after` runs
once and can fetch every product in a single query - but then the text renders
under the whole list instead of under each line.

## Run it

```bash
shopify app dev
```

Open the preview URL, add a product that has a note to the cart, and go to
checkout.
