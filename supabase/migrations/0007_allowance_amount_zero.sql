-- A pocket that's disabled for a child shouldn't force the parent to also
-- assign it an allowance amount (previously every pocket needed >= 1, even
-- ones that were turned off and therefore never paid). Relax the minimum
-- to 0; the app only enforces >= 1 for pockets currently enabled for that
-- child, and submits 0 for disabled ones.

alter table allowance_configs drop constraint allowance_configs_spend_amount_check;
alter table allowance_configs drop constraint allowance_configs_savings_amount_check;
alter table allowance_configs drop constraint allowance_configs_investments_amount_check;

alter table allowance_configs add constraint allowance_configs_spend_amount_check check (spend_amount >= 0);
alter table allowance_configs add constraint allowance_configs_savings_amount_check check (savings_amount >= 0);
alter table allowance_configs add constraint allowance_configs_investments_amount_check check (investments_amount >= 0);
