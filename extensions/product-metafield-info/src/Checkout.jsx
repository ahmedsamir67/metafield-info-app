import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';

export default async () => {
  render(<Extension />, document.body);
};

/**
 * The product metafield this extension reads.
 *
 * Its definition must exist in Shopify admin with Storefront access set to
 * PUBLIC_READ. Otherwise the Storefront API returns null for `metafield` with
 * no error at all, and every line renders nothing with nothing in the console
 * to explain why.
 *
 * Its type is `list.single_line_text_field`, so `value` arrives as a JSON
 * array encoded in a string - see parseNotes below.
 */
const SHOPPING_NOTE_QUERY = `
  query ProductShoppingNote($id: ID!) {
    product(id: $id) {
      metafield(namespace: "custom", key: "shopping_note") {
        value
      }
    }
  }
`;

function Extension() {
  // This target is instantiated once per cart line, so each instance only ever
  // looks at its own line's product. The cart line carries the product GID for
  // free, but not its metafields - hence the query below.
  const productId = shopify.target.value.merchandise.product.id;
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    let cancelled = false;

    shopify
      .query(SHOPPING_NOTE_QUERY, {variables: {id: productId}})
      .then(({data, errors}) => {
        if (cancelled) {
          return;
        }

        if (errors?.length) {
          console.error('[product-metafield-info] Storefront API errors:', errors);
          return;
        }

        setNotes(parseNotes(data?.product?.metafield?.value));
      })
      .catch((error) => {
        console.error('[product-metafield-info] Metafield query failed:', error);
      });

    // Runs on unmount, or if this line's product changes. Drops a response that
    // lands after either, so we never setState on a dead component.
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Render nothing while loading, when this product has no notes, and on error.
  // A spinner under every line item is worse than showing nothing.
  if (notes.length === 0) {
    return null;
  }

  return (
    <s-stack gap="small-300">
      {notes.map((note) => (
        <s-text key={note} tone="neutral">
          {note}
        </s-text>
      ))}
    </s-stack>
  );
}

/**
 * A metafield `value` is ALWAYS a string; `type` says how to read it. For a
 * list type that string is JSON: "[\"Ships in a reinforced box\"]". Printing it
 * raw would show the customer the brackets and escaped quotes.
 *
 * Falls back to treating the value as a single plain note if it ever stops
 * being valid JSON - e.g. if the definition is later changed to a non-list type.
 */
function parseNotes(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [String(parsed)];
  } catch {
    return [value];
  }
}
