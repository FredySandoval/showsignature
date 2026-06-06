use std::{fmt, io};
pub use crate::prelude::*;
mod inner;
extern crate alloc;

// module comment
/* block
comment */

pub const VERSION: &str = "1.0";
static COUNT: usize = 3;

pub trait Named {
    fn name(&self) -> &str;
}

pub struct User {
    pub id: u64,
}

enum State {
    Ready,
}

type UserId = u64;

pub async fn load(id: UserId) -> Result<User, Error> {
    todo!()
}

fn helper(value: &str) -> String {
    value.to_owned()
}
