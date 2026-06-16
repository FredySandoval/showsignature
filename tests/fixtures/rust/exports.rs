// rust/basic.rs
2 use crate::prelude::*;
10 const VERSION: &str = "1.0"
13 trait Named {
17 struct User {
27 async fn load(id: UserId) -> Result<User, Error> ...
