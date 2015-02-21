BEGIN {
	printf("tracing, ctrl-c to exit...\n");
}

syscall::read:entry
{
	self->ts = timestamp;
}

syscall::read:return
/self->ts/
{
	@[execname, "ns"] = quantize(timestamp - self->ts);
	self->ts = 0;
}
