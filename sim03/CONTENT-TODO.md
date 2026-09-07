# Authored content required before catalogue publication

The implementation intentionally leaves two supplied-spec gaps unresolved rather than inventing course content.

## 1. Year 3 calibration gap

The supplied table defines:

- Connect >= 5 AND Capacity >= 2 -> successful AI failure prediction
- Connect 3-4 -> pilot
- Connect <= 2 -> no usable prediction data

It does not define the case where cumulative Connect >= 5 but cumulative Capacity < 2.
The engine returns `unresolved_calibration` for that case and the instructor console counts it explicitly.

## 2. Three buyer valuations

The flow calls for the same portfolio to receive three buyer valuations with no winner declared, but the supplied spec does not define the buyers, valuation rules, numbers, or narrative.
The student screen therefore shows three clearly marked authored-content placeholders.

Resolve these two items before publishing `rapid-03-midland` in the catalogue.
