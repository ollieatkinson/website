# Swift syntax highlighting

Prism 1.30.0, MIT licensed: https://github.com/PrismJS/prism/tree/v1.30.0

Only Prism core and the Swift grammar are shipped (10,400 bytes total), with no
plugins, CDN requests, or additional languages. The license is included here.
The npm dependency and lockfile pin the upstream package.

After an intentional version update, run `node Tools/vendor-highlighter.cjs`.
CI uses `--check` to compare these files against the installed package.
