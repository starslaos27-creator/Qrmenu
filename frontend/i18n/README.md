# ShopQR languages

The frontend supports Thai (`th`), Lao (`lo`), English (`en`), Korean (`ko`),
Vietnamese (`vi`), and Chinese (`zh`). Each locale has its own JSON file. Keep
the same translation keys in all six files so a missing translation can fall
back to Thai.

Add or update a key in all files, for example:

```json
"finance.closing.title": "Daily closing"
```

The language picker stores the choice in browser local storage and applies the
locale to the current screen, including legacy screens shown in the same-origin
iframe. Translation runs locally from these dictionaries and does not call an
external translation API.

After building the frontend, run `npm run i18n:audit` from `frontend/` to
check Thai text in both the current React app and the legacy iframe bundles for
missing dictionary entries.

The Korean, Vietnamese, and Chinese files each contain all 2,513 frontend
translation keys. Their remaining unchanged English values are technical names,
units, abbreviations, or proper names such as USB, VAT, PromptPay, and the bank's
registered name.
