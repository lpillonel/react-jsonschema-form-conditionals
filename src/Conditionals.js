import predicate from "predicate";

const POSITIVE_PREDICATE = predicate;
const NEGATIVE_PREDICATE = predicate.not;

function isObject(obj) {
  return typeof obj === "object" && obj !== null;
}

function toError(message) {
  if (process.env.NODE_ENV !== "production") {
    throw new ReferenceError(message);
  } else {
    console.error(message);
  }
  return false;
}

export function check(
  fieldVal,
  rule,
  predicator = predicate,
  condition = Array.prototype.every
) {
  if (isObject(rule)) {
    // Complicated rule - like { greater then 10 }
    return condition.call(Object.keys(rule), p => {
      let comparable = rule[p];
      if (isObject(comparable) || p === "not") {
        if (p === "or") {
          if (Array.isArray(comparable)) {
            return comparable.some(condition =>
              check(fieldVal, condition, predicator, Array.prototype.every)
            );
          } else {
            return toError(`OR must be an array`);
          }
        } else if (p === "not") {
          let oppositePredicator = predicator === NEGATIVE_PREDICATE
            ? POSITIVE_PREDICATE
            : NEGATIVE_PREDICATE;
          return check(
            fieldVal,
            comparable,
            oppositePredicator,
            Array.prototype.every
          );
        } else {
          return check(
            fieldVal,
            comparable,
            predicator[p],
            Array.prototype.every
          );
        }
      } else {
        return predicator[p](fieldVal, comparable);
      }
    });
  } else {
    // Simple rule - like emptyString
    return predicator[rule](fieldVal);
  }
}

export function applyWhen(
  rule,
  formData,
  condition = Array.prototype.every
) {
  if (!isObject(rule) || !isObject(formData)) {
    return toError(`Rule ${rule} with ${formData} can't be processed`);
  }
  return condition.call(Object.keys(rule), ref => {
    if (ref === "or") {
      return applyWhen(rule[ref], formData, Array.prototype.some);
    } else if (ref === "and") {
      return applyWhen(rule[ref], formData, Array.prototype.every);
    } else {
      let refVal = formData[ref];
      let refFieldRule = rule[ref];
      return check(refVal, refFieldRule);
    }
  });
}

function toActions(fieldRules, formData) {
  if (Array.isArray(fieldRules)) {
    return fieldRules.filter((rule) => applyWhen(rule.when, formData)).map(rule => rule.action);
  } else {
    if (applyWhen(fieldRules.when, formData)) {
      return [fieldRules.action];
    } else {
      return [];
    }
  }
}

export function fieldToActions(rules = {}, formData = {}) {
  let agg = {};
  Object.keys(rules).forEach(field => {
    let actions = toActions(rules[field], formData);
    if (actions.length !== 0) {
      agg[field] = actions;
    }
  });
  return agg;
}