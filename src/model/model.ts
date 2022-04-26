export interface Token {
    token_id: Number,
    image: String,
    rank: Number,
    score: Number,
    traits: Trait[]
}

export interface Trait {
    type: String,
    value: String,
    occurrences: Number,
    percentage: Number,
    score: Number
}
